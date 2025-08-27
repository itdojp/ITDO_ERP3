import express from 'express';
import amqp from 'amqplib';
import { nanoid } from 'nanoid';
import Redis from 'ioredis';

const AMQP_URL = process.env.AMQP_URL || 'amqp://guest:guest@rabbitmq:5672';
const NUM_SHARDS = parseInt(process.env.NUM_SHARDS || '4', 10);
const PORT = parseInt(process.env.PORT || '3003', 10);

function shardFor(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % NUM_SHARDS;
}

async function setupRabbit() {
  const conn = await amqp.connect(AMQP_URL);
  const ch = await conn.createChannel();
  const ex = 'events';
  await ch.assertExchange(ex, 'direct', { durable: true });
  for (let i = 0; i < NUM_SHARDS; i++) {
    const q = `shard.${i}`;
    await ch.assertQueue(q, { durable: true, deadLetterExchange: 'dlx', deadLetterRoutingKey: q + '.dead' });
    await ch.bindQueue(q, ex, `shard.${i}`);
    await ch.assertExchange('dlx', 'direct', { durable: true });
    await ch.assertQueue(q + '.dead', { durable: true });
    await ch.bindQueue(q + '.dead', 'dlx', q + '.dead');
  }
  return { conn, ch };
}

async function main() {
  const { conn, ch } = await setupRabbit();
  const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.post('/sales/orders/confirm', async (req, res) => {
    try {
      const { orderId, customerId, amount } = req.body || {};
      if (!orderId || !customerId || typeof amount !== 'number') {
        return res.status(400).json({ error: 'orderId, customerId, amount required' });
      }
      const eventId = nanoid();
      const idempotencyKey = req.header('Idempotency-Key') || `order-${orderId}`;
      const payload = {
        eventId,
        occurredAt: new Date().toISOString(),
        eventType: 'sales.order.confirmed',
        tenantId: 'demo',
        orderId,
        customerId,
        amount
      };
      const shard = shardFor(orderId);
      ch.publish('events', `shard.${shard}`, Buffer.from(JSON.stringify(payload)), {
        contentType: 'application/json', messageId: eventId, headers: { idempotencyKey, orderId }
      });
      await redis.incr('metrics:events:sales.order.confirmed').catch(()=>{});
      res.status(202).json({ accepted: true, eventId, shard });
    } catch (e) {
      console.error('[sales-service] error', e);
      res.status(500).json({ error: 'internal' });
    }
  });

  app.listen(PORT, () => console.log(`[sales-service] listening on :${PORT}`));
  process.on('SIGINT', () => conn.close().finally(() => process.exit(0)));
}

main().catch((e) => { console.error('[sales-service] fatal', e); process.exit(1); });
