import amqp from 'amqplib';
import { nanoid } from 'nanoid';

const AMQP_URL = process.env.AMQP_URL || 'amqp://guest:guest@localhost:5672';
const NUM_SHARDS = parseInt(process.env.NUM_SHARDS || '4', 10);
const BATCH = parseInt(process.env.PRODUCER_BATCH || '100', 10);
const RPS = parseInt(process.env.PRODUCER_RPS || '50', 10);

function shardFor(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % NUM_SHARDS;
}

async function main() {
  const conn = await amqp.connect(AMQP_URL);
  const ch = await conn.createChannel();
  const ex = 'events';
  await ch.assertExchange(ex, 'direct', { durable: true });

  // declare shard queues and bindings (idempotent)
  for (let i = 0; i < NUM_SHARDS; i++) {
    const q = `shard.${i}`;
    await ch.assertQueue(q, {
      durable: true,
      deadLetterExchange: 'dlx',
      deadLetterRoutingKey: q + '.dead'
    });
    await ch.bindQueue(q, ex, `shard.${i}`);
    await ch.assertExchange('dlx', 'direct', { durable: true });
    await ch.assertQueue(q + '.dead', { durable: true });
    await ch.bindQueue(q + '.dead', 'dlx', q + '.dead');
  }

  let sent = 0;
  const interval = 1000 / Math.max(1, RPS);

  const timer = setInterval(() => {
    if (sent >= BATCH) {
      clearInterval(timer);
      setTimeout(() => { conn.close().catch(()=>{}); }, 500);
      return;
    }
    // simulate some timesheetIds (repeat to test ordering)
    const timesheetId = 'TS-' + ((sent % Math.min(10, BATCH)) + 1).toString().padStart(3, '0');
    const eventId = nanoid();
    const idempotencyKey = nanoid();
    const payload = {
      eventId,
      occurredAt: new Date().toISOString(),
      tenantId: 'demo',
      timesheetId,
      employeeId: 'E-001',
      projectId: 'P-001',
      approvedBy: 'M-001',
      hours: 8,
      rateType: 'standard',
      idempotencyKey
    };
    const shard = shardFor(timesheetId);
    const ok = ch.publish('events', `shard.${shard}`, Buffer.from(JSON.stringify(payload)), {
      contentType: 'application/json',
      messageId: eventId,
      headers: { idempotencyKey, timesheetId }
    });
    if (ok) sent++;
    if (sent % 10 === 0) console.log(`[producer] sent ${sent}/${BATCH}`);
  }, interval);
}

main().catch((e) => {
  console.error('[producer] error', e);
  process.exit(1);
});

