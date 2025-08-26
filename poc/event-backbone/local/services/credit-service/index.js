import amqp from 'amqplib';

const AMQP_URL = process.env.AMQP_URL || 'amqp://guest:guest@rabbitmq:5672';
const NUM_SHARDS = parseInt(process.env.NUM_SHARDS || '4', 10);
const CREDIT_LIMIT = parseInt(process.env.CREDIT_LIMIT || '1000000', 10);

async function main() {
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
        const payload = JSON.parse(msg.content.toString());
        if (payload.eventType === 'sales.order.confirmed') {
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
          const shard = i; // same shard ensures ordering per orderId
          ch.publish('events', `shard.${shard}`, Buffer.from(JSON.stringify(event)), {
            contentType: 'application/json', messageId: event.eventId, headers: { orderId: payload.orderId }
          });
        }
        ch.ack(msg);
      } catch (e) {
        console.warn('[credit-service] error', e.message);
        ch.reject(msg, false);
      }
    });
  }
  console.log(`[credit-service] started with CREDIT_LIMIT=${CREDIT_LIMIT}`);
}

main().catch((e) => { console.error('[credit-service] fatal', e); process.exit(1); });

