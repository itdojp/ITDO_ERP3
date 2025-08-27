import amqp from 'amqplib';
import express from 'express';

const AMQP_URL = process.env.AMQP_URL || 'amqp://guest:guest@rabbitmq:5672';
const NUM_SHARDS = parseInt(process.env.NUM_SHARDS || '4', 10);
const CREDIT_LIMIT = parseInt(process.env.CREDIT_LIMIT || '1000000', 10);
const PORT = parseInt(process.env.PORT || '3004', 10);

async function main() {
  const conn = await amqp.connect(AMQP_URL);
  const ex = 'events';
  const pub = await conn.createChannel();
  await pub.assertExchange(ex, 'direct', { durable: true });

  // Consumer for sales.order.confirmed
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
        if (payload.eventType === 'sales.order.confirmed' || payload.eventType === 'sales.credit.requested') {
          const approved = (payload.amount || 0) <= CREDIT_LIMIT;
          const event = {
            eventId: msg.properties.messageId + '.credit',
            occurredAt: new Date().toISOString(),
            eventType: approved ? 'sales.credit.approved' : 'sales.credit.rejected',
            tenantId: payload.tenantId,
            orderId: payload.orderId,
            customerId: payload.customerId,
            amount: payload.amount
          };
          pub.publish('events', `shard.${i}`, Buffer.from(JSON.stringify(event)), {
            contentType: 'application/json', messageId: event.eventId, headers: { orderId: payload.orderId }
          });
          if (!approved) {
            const onhold = { ...event, eventId: event.eventId + '.onhold', eventType: 'sales.credit.onhold' };
            pub.publish('events', `shard.${i}`, Buffer.from(JSON.stringify(onhold)), {
              contentType: 'application/json', messageId: onhold.eventId, headers: { orderId: payload.orderId }
            });
          }
        }
        ch.ack(msg);
      } catch (e) {
        console.warn('[credit-service] error', e.message);
        ch.reject(msg, false);
      }
    });
  }

  // Minimal override API
  const app = express();
  app.use(express.json());
  app.post('/credit/override', async (req, res) => {
    try {
      const { orderId, customerId = 'unknown', amount = 0, approver = 'manager' } = req.body || {};
      if (!orderId) return res.status(400).json({ error: 'orderId required' });
      const event = {
        eventId: `override-${orderId}-${Date.now()}`,
        occurredAt: new Date().toISOString(),
        eventType: 'sales.credit.override.approved',
        tenantId: 'demo',
        orderId,
        customerId,
        amount,
        approver
      };
      // shard by orderId
      let h = 0; for (let i = 0; i < orderId.length; i++) h = (h * 31 + orderId.charCodeAt(i)) >>> 0;
      const shard = h % NUM_SHARDS;
      pub.publish('events', `shard.${shard}`, Buffer.from(JSON.stringify(event)), { contentType: 'application/json', messageId: event.eventId });
      res.status(202).json({ accepted: true, eventId: event.eventId, shard });
    } catch (e) {
      console.error('[credit-service] override error', e);
      res.status(500).json({ error: 'internal' });
    }
  });
  app.post('/credit/reapply', async (req, res) => {
    try {
      const { orderId, customerId = 'unknown', amount } = req.body || {};
      if (!orderId || typeof amount !== 'number') return res.status(400).json({ error: 'orderId and amount required' });
      const event = {
        eventId: `reapply-${orderId}-${Date.now()}`,
        occurredAt: new Date().toISOString(),
        eventType: 'sales.credit.requested',
        tenantId: 'demo',
        orderId,
        customerId,
        amount
      };
      let h = 0; for (let i = 0; i < orderId.length; i++) h = (h * 31 + orderId.charCodeAt(i)) >>> 0;
      const shard = h % NUM_SHARDS;
      pub.publish('events', `shard.${shard}`, Buffer.from(JSON.stringify(event)), { contentType: 'application/json', messageId: event.eventId });
      res.status(202).json({ accepted: true, eventId: event.eventId, shard });
    } catch (e) {
      console.error('[credit-service] reapply error', e);
      res.status(500).json({ error: 'internal' });
    }
  });
  app.post('/credit/revoke', async (req, res) => {
    try {
      const { orderId, customerId = 'unknown', amount = 0 } = req.body || {};
      if (!orderId) return res.status(400).json({ error: 'orderId required' });
      const event = {
        eventId: `revoke-${orderId}-${Date.now()}`,
        occurredAt: new Date().toISOString(),
        eventType: 'sales.credit.revoked',
        tenantId: 'demo',
        orderId,
        customerId,
        amount
      };
      let h = 0; for (let i = 0; i < orderId.length; i++) h = (h * 31 + orderId.charCodeAt(i)) >>> 0;
      const shard = h % NUM_SHARDS;
      pub.publish('events', `shard.${shard}`, Buffer.from(JSON.stringify(event)), { contentType: 'application/json', messageId: event.eventId });
      res.status(202).json({ accepted: true, eventId: event.eventId, shard });
    } catch (e) {
      console.error('[credit-service] revoke error', e);
      res.status(500).json({ error: 'internal' });
    }
  });
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.listen(PORT, () => console.log(`[credit-service] listening on :${PORT} (CREDIT_LIMIT=${CREDIT_LIMIT})`));
}

main().catch((e) => { console.error('[credit-service] fatal', e); process.exit(1); });
