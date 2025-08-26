import amqp from 'amqplib';
import Redis from 'ioredis';
import express from 'express';

const AMQP_URL = process.env.AMQP_URL || 'amqp://guest:guest@rabbitmq:5672';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const NUM_SHARDS = parseInt(process.env.NUM_SHARDS || '4', 10);
const PORT = parseInt(process.env.PORT || '3002', 10);

function storeKey(invoiceId) { return `invoice:${invoiceId}`; }

async function processMessage(redis, msg) {
  const content = JSON.parse(msg.content.toString());
  const key = content.idempotencyKey || (msg.properties.headers?.idempotencyKey);
  if (!key) return { status: 'error', reason: 'no-idempotency-key' };
  const ok = await redis.set(`idemp:${key}`, '1', 'NX', 'EX', 60 * 60);
  if (ok === null) {
    return { status: 'duplicate' };
  }
  const invoiceId = `INV-${content.timesheetId}-${Date.now()}`;
  const now = Date.now();
  let latencyMs = null;
  try { latencyMs = now - new Date(content.occurredAt).getTime(); } catch (_) {}
  const invoice = {
    invoiceId,
    timesheetId: content.timesheetId,
    projectId: content.projectId,
    employeeId: content.employeeId,
    amount: Math.round((content.hours || 0) * 10000),
    currency: 'JPY',
    createdAt: new Date(now).toISOString(),
    latencyMs,
    attachmentUrl: content.attachmentUrl || null
  };
  await redis.hset(storeKey(invoiceId), invoice);
  await redis.lpush('invoices', invoiceId);
  console.log(`[fi-service] invoice ${invoiceId} created (ts=${content.timesheetId}) latency=${latencyMs}ms`);
  return { status: 'ok', invoiceId };
}

async function consume(redis) {
  const conn = await amqp.connect(AMQP_URL);
  const ex = 'events';
  for (let i = 0; i < NUM_SHARDS; i++) {
    const ch = await conn.createChannel();
    await ch.prefetch(1);
    await ch.assertExchange(ex, 'direct', { durable: true });
    const q = `shard.${i}`;
    await ch.assertQueue(q, { durable: true, deadLetterExchange: 'dlx', deadLetterRoutingKey: q + '.dead' });
    await ch.bindQueue(q, ex, q);
    ch.consume(q, async (msg) => {
      if (!msg) return;
      try {
        const res = await processMessage(redis, msg);
        if (res.status === 'ok' || res.status === 'duplicate') ch.ack(msg); else ch.reject(msg, false);
      } catch (e) {
        console.warn('[fi-service] error:', e.message);
        ch.reject(msg, false);
      }
    });
  }
}

async function main() {
  const redis = new Redis(REDIS_URL);
  consume(redis).catch((e) => { console.error('[fi-service] consume error', e); process.exit(1); });

  const app = express();
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/invoices', async (_req, res) => {
    const ids = await redis.lrange('invoices', 0, 99);
    const multi = redis.multi();
    ids.forEach(id => multi.hgetall(storeKey(id)));
    const rows = await multi.exec();
    res.json(rows.map(([, v]) => v).filter(Boolean));
  });
  app.get('/invoices/:id', async (req, res) => {
    const row = await redis.hgetall(storeKey(req.params.id));
    if (!row || !row.invoiceId) return res.status(404).json({ error: 'not found' });
    res.json(row);
  });
  app.listen(PORT, () => console.log(`[fi-service] listening on :${PORT}`));
}

main().catch((e) => { console.error('[fi-service] fatal', e); process.exit(1); });

