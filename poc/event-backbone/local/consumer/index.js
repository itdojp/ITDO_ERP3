import amqp from 'amqplib';
import Redis from 'ioredis';

const AMQP_URL = process.env.AMQP_URL || 'amqp://guest:guest@localhost:5672';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const NUM_SHARDS = parseInt(process.env.NUM_SHARDS || '4', 10);
const FAIL_RATE = parseFloat(process.env.FAIL_RATE || '0');

function randomFail() {
  return Math.random() < FAIL_RATE;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectRabbitWithRetry(context = 'consumer') {
  let attempt = 0;
  while (true) {
    try {
      const conn = await amqp.connect(AMQP_URL);
      if (attempt > 0) console.log(`[${context}] connected to RabbitMQ after ${attempt} retries`);
      return conn;
    } catch (err) {
      attempt += 1;
      const delay = Math.min(10000, 1000 * attempt);
      console.warn(`[${context}] rabbitmq connect failed (attempt ${attempt}): ${err.message}. retry in ${delay}ms`);
      await sleep(delay);
    }
  }
}

async function processMessage(redis, msg) {
  const content = JSON.parse(msg.content.toString());
  const key = content.idempotencyKey || (msg.properties.headers?.idempotencyKey);
  if (!key) return { status: 'error', reason: 'no-idempotency-key' };

  // set NX to prevent duplicates
  const ok = await redis.set(`idemp:${key}`, '1', 'NX', 'EX', 60 * 60);
  if (ok === null) {
    return { status: 'duplicate' };
  }

  if (randomFail()) {
    throw new Error('simulated failure');
  }

  // simulate invoice generation
  const invoiceId = `INV-${content.timesheetId}-${Date.now()}`;
  const now = Date.now();
  let latencyMs = null;
  try { latencyMs = now - new Date(content.occurredAt).getTime(); } catch (_) {}
  const latencyInfo = latencyMs != null ? ` latency=${latencyMs}ms` : '';
  const attach = content.attachmentUrl ? ` attachmentUrl=${content.attachmentUrl}` : '';
  console.log(`[consumer] invoice generated: ${invoiceId} for ${content.timesheetId}${latencyInfo}${attach}`);
  return { status: 'ok', invoiceId };
}

async function main() {
  const redis = new Redis(REDIS_URL);
  const conn = await connectRabbitWithRetry();
  const ex = 'events';

  for (let i = 0; i < NUM_SHARDS; i++) {
    const ch = await conn.createChannel();
    await ch.prefetch(1);
    await ch.assertExchange(ex, 'direct', { durable: true });
    const q = `shard.${i}`;
    await ch.assertQueue(q, {
      durable: true,
      deadLetterExchange: 'dlx',
      deadLetterRoutingKey: q + '.dead'
    });
    await ch.bindQueue(q, ex, q);
    await ch.assertExchange('dlx', 'direct', { durable: true });
    await ch.assertQueue(q + '.dead', { durable: true });
    await ch.bindQueue(q + '.dead', 'dlx', q + '.dead');

    ch.consume(q, async (msg) => {
      if (!msg) return;
      try {
        const res = await processMessage(redis, msg);
        if (res.status === 'duplicate') {
          console.log('[consumer] duplicate, ack');
          ch.ack(msg);
        } else if (res.status === 'ok') {
          ch.ack(msg);
        } else {
          console.warn('[consumer] processing error, reject to DLQ');
          ch.reject(msg, false);
        }
      } catch (e) {
        console.warn('[consumer] error:', e.message, '→ DLQ');
        ch.reject(msg, false);
      }
    });
  }
}

main().catch((e) => {
  console.error('[consumer] error', e);
  process.exit(1);
});
