import express from 'express';
import Redis from 'ioredis';
import amqp from 'amqplib';

const PORT = parseInt(process.env.PORT || '3006', 10);
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const AMQP_URL = process.env.AMQP_URL || 'amqp://guest:guest@rabbitmq:5672';
const NUM_SHARDS = parseInt(process.env.NUM_SHARDS || '4', 10);

const redis = new Redis(REDIS_URL);

function shardOf(key) {
  let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0; return h % NUM_SHARDS;
}

async function main() {
  const conn = await amqp.connect(AMQP_URL);
  const pub = await conn.createChannel();
  await pub.assertExchange('events', 'direct', { durable: true });

  const app = express();
  app.use(express.json());

  // Create/Update contract
  app.post('/contracts', async (req, res) => {
    const { contractId, customerId, renewalDate, amount = 0 } = req.body || {};
    if (!contractId || !customerId || !renewalDate) return res.status(400).json({ error: 'contractId, customerId, renewalDate required' });
    await redis.hset(`contract:${contractId}`, { customerId, renewalDate, amount });
    await redis.sadd('contracts', contractId);
    res.status(201).json({ ok: true });
  });

  // Trigger reminders for contracts expiring within N days
  app.post('/contracts/reminders/trigger', async (req, res) => {
    const days = parseInt((req.body && req.body.days) || '30', 10);
    const now = Date.now();
    const cutoff = now + days * 24 * 60 * 60 * 1000;
    const ids = await redis.smembers('contracts');
    let sent = 0;
    for (const id of ids) {
      const h = await redis.hgetall(`contract:${id}`);
      if (!h || !h.renewalDate) continue;
      const due = Date.parse(h.renewalDate);
      if (isNaN(due)) continue;
      if (due <= cutoff) {
        const evt = {
          eventId: `contract-reminder-${id}-${Date.now()}`,
          occurredAt: new Date().toISOString(),
          eventType: 'ckm.contract.renewal.reminder',
          contractId: id,
          customerId: h.customerId,
          renewalDate: h.renewalDate
        };
        const shard = shardOf(id);
        pub.publish('events', `shard.${shard}`, Buffer.from(JSON.stringify(evt)), { contentType: 'application/json', messageId: evt.eventId });
        sent++;
      }
    }
    res.json({ sent });
  });

  // Renew a contract now (manual action)
  app.post('/contracts/:id/renew', async (req, res) => {
    const id = req.params.id;
    const { newDate } = req.body || {};
    if (!newDate) return res.status(400).json({ error: 'newDate required' });
    const exists = await redis.exists(`contract:${id}`);
    if (!exists) return res.status(404).json({ error: 'not_found' });
    await redis.hset(`contract:${id}`, { renewalDate: newDate });
    const evt = {
      eventId: `contract-renewed-${id}-${Date.now()}`,
      occurredAt: new Date().toISOString(),
      eventType: 'ckm.contract.renewed',
      contractId: id,
      renewalDate: newDate
    };
    const shard = shardOf(id);
    pub.publish('events', `shard.${shard}`, Buffer.from(JSON.stringify(evt)), { contentType: 'application/json', messageId: evt.eventId });
    res.json({ ok: true, eventId: evt.eventId });
  });

  app.get('/contracts', async (_req, res) => {
    const ids = await redis.smembers('contracts');
    const multi = redis.multi();
    ids.forEach((id) => multi.hgetall(`contract:${id}`));
    const rows = await multi.exec();
    res.json(ids.map((id, idx) => ({ contractId: id, ...rows[idx][1] })));
  });

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.listen(PORT, () => console.log(`[contract-service] listening on :${PORT}`));
}

main().catch((e) => { console.error('[contract-service] fatal', e); process.exit(1); });

