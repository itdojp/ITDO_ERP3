import amqp from 'amqplib';
import Redis from 'ioredis';
import express from 'express';

const AMQP_URL = process.env.AMQP_URL || 'amqp://guest:guest@rabbitmq:5672';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const NUM_SHARDS = parseInt(process.env.NUM_SHARDS || '4', 10);
const PORT = parseInt(process.env.PORT || '3002', 10);
const INJECT_DELAY_MS = parseInt(process.env.INJECT_DELAY_MS || '0', 10);
const INJECT_FAIL_RATE = parseFloat(process.env.INJECT_FAIL_RATE || '0');
const FI_ENFORCE_CREDIT = (process.env.FI_ENFORCE_CREDIT || 'true').toLowerCase() === 'true';

function storeKey(invoiceId) { return `invoice:${invoiceId}`; }

async function maybeEmitBudgetAllocated(redis, pub, orderId) {
  const [credit, projectId, amount, emitted] = await redis.mget(
    `order:${orderId}:credit`,
    `order:${orderId}:projectId`,
    `order:${orderId}:amount`,
    `order:${orderId}:budget_emitted`
  );
  if (emitted === '1') return;
  if (credit === 'approved' && projectId && amount) {
    const event = {
      eventId: `budget-${orderId}-${Date.now()}`,
      occurredAt: new Date().toISOString(),
      eventType: 'fi.budget.allocated',
      tenantId: 'demo',
      orderId,
      projectId,
      amount: Number(amount)
    };
    const shardKey = orderId;
    // simple shard calc
    let h = 0; for (let i = 0; i < shardKey.length; i++) h = (h * 31 + shardKey.charCodeAt(i)) >>> 0;
    const shard = h % NUM_SHARDS;
    await pub.publish('events', `shard.${shard}`, Buffer.from(JSON.stringify(event)), { contentType: 'application/json', messageId: event.eventId });
    await redis.set(`order:${orderId}:budget_emitted`, '1', 'EX', 24 * 60 * 60);
    console.log(`[fi-service] budget allocated for order ${orderId} -> project ${projectId} amount=${amount}`);
  }
}

async function processMessage(redis, msg) {
  const content = JSON.parse(msg.content.toString());
  const key = content.idempotencyKey || (msg.properties.headers?.idempotencyKey);
  if (!key) return { status: 'error', reason: 'no-idempotency-key' };
  const ok = await redis.set(`idemp:${key}`, '1', 'NX', 'EX', 60 * 60);
  if (ok === null) {
    return { status: 'duplicate' };
  }
  if (INJECT_DELAY_MS > 0) await new Promise(r => setTimeout(r, INJECT_DELAY_MS));
  if (Math.random() < INJECT_FAIL_RATE) throw new Error('injected failure');

  // Guard: if project is mapped to an order, require credit approval and (optionally) budget allocation
  if (FI_ENFORCE_CREDIT && content.projectId) {
    const orderId = await redis.get(`project:${content.projectId}:orderId`);
    if (orderId) {
      const credit = await redis.get(`order:${orderId}:credit`);
      if (credit !== 'approved') {
        console.warn(`[fi-service] credit not approved for order ${orderId} → skip invoice`);
        return { status: 'skipped' };
      }
      if ((process.env.FI_REQUIRE_BUDGET || 'true').toLowerCase() === 'true') {
        const budgetEmitted = await redis.get(`order:${orderId}:budget_emitted`);
        if (budgetEmitted !== '1') {
          console.warn(`[fi-service] budget not allocated for order ${orderId} → skip invoice`);
          return { status: 'skipped' };
        }
      }
    }
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
  const pub = await conn.createChannel();
  await pub.assertExchange(ex, 'direct', { durable: true });
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
        const payload = JSON.parse(msg.content.toString());
        // route by event type / payload shape
        if (payload.eventType === 'sales.credit.approved') {
          await redis.set(`order:${payload.orderId}:credit`, 'approved', 'EX', 24 * 60 * 60);
          if (typeof payload.amount === 'number') {
            await redis.set(`order:${payload.orderId}:amount`, String(payload.amount), 'EX', 24 * 60 * 60);
          }
          await maybeEmitBudgetAllocated(redis, pub, payload.orderId);
          console.log(`[fi-service] credit approved for order ${payload.orderId}`);
          ch.ack(msg);
        } else if (payload.eventType === 'sales.credit.rejected') {
          await redis.set(`order:${payload.orderId}:credit`, 'rejected', 'EX', 24 * 60 * 60);
          console.log(`[fi-service] credit rejected for order ${payload.orderId}`);
          ch.ack(msg);
        } else if (payload.eventType === 'pm.project.created') {
          await redis.set(`order:${payload.orderId}:projectId`, payload.projectId, 'EX', 24 * 60 * 60);
          await redis.set(`project:${payload.projectId}:orderId`, payload.orderId, 'EX', 24 * 60 * 60);
          await maybeEmitBudgetAllocated(redis, pub, payload.orderId);
          console.log(`[fi-service] mapped order ${payload.orderId} -> project ${payload.projectId}`);
          ch.ack(msg);
        } else if (payload.eventType === 'pm.project.cancelled') {
          const orderId = await redis.get(`project:${payload.projectId}:orderId`);
          if (orderId) {
            await redis.del(`order:${orderId}:projectId`);
            await redis.del(`project:${payload.projectId}:orderId`);
            console.log(`[fi-service] unmapped project ${payload.projectId} from order ${orderId}`);
          }
          ch.ack(msg);
        } else if (payload.eventType === 'sales.credit.revoked') {
          await redis.set(`order:${payload.orderId}:credit`, 'revoked', 'EX', 24 * 60 * 60);
          console.log(`[fi-service] credit revoked for order ${payload.orderId}`);
          ch.ack(msg);
        } else if (payload.timesheetId) {
          // legacy timesheet -> invoice path
          msg.content = Buffer.from(JSON.stringify(payload));
          const res = await processMessage(redis, msg);
          if (res.status === 'ok' || res.status === 'duplicate') ch.ack(msg); else ch.reject(msg, false);
        } else {
          // ignore other events for now
          ch.ack(msg);
        }
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
  app.get('/orders/:orderId/status', async (req, res) => {
    const { orderId } = req.params;
    const credit = await redis.get(`order:${orderId}:credit`);
    const projectId = await redis.get(`order:${orderId}:projectId`);
    const amount = await redis.get(`order:${orderId}:amount`);
    const budgetEmitted = await redis.get(`order:${orderId}:budget_emitted`);
    res.json({ orderId, credit: credit || 'unknown', projectId: projectId || null, amount: amount ? Number(amount) : null, budgetAllocated: budgetEmitted === '1' });
  });
  app.get('/invoices/:id', async (req, res) => {
    const row = await redis.hgetall(storeKey(req.params.id));
    if (!row || !row.invoiceId) return res.status(404).json({ error: 'not found' });
    res.json(row);
  });
  app.listen(PORT, () => console.log(`[fi-service] listening on :${PORT}`));
}

main().catch((e) => { console.error('[fi-service] fatal', e); process.exit(1); });
