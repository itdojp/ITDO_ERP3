import amqp from 'amqplib';
import { nanoid } from 'nanoid';
import { Client as MinioClient } from 'minio';

const AMQP_URL = process.env.AMQP_URL || 'amqp://guest:guest@localhost:5672';
const NUM_SHARDS = parseInt(process.env.NUM_SHARDS || '4', 10);
const BATCH = parseInt(process.env.PRODUCER_BATCH || '100', 10);
const RPS = parseInt(process.env.PRODUCER_RPS || '50', 10);
const USE_MINIO = (process.env.USE_MINIO || 'false').toLowerCase() === 'true';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const MINIO_USE_SSL = (process.env.MINIO_USE_SSL || 'false').toLowerCase() === 'true';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'events';

let minioClient = null;

async function ensureBucket() {
  if (!USE_MINIO) return;
  minioClient = new MinioClient({ endPoint: MINIO_ENDPOINT, port: MINIO_PORT, useSSL: MINIO_USE_SSL, accessKey: MINIO_ACCESS_KEY, secretKey: MINIO_SECRET_KEY });
  const exists = await minioClient.bucketExists(MINIO_BUCKET).catch(() => false);
  if (!exists) await minioClient.makeBucket(MINIO_BUCKET, 'us-east-1');
}

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
  await ensureBucket();

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

  const timer = setInterval(async () => {
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
    // optionally store a large blob in MinIO and attach reference URL
    if (USE_MINIO && minioClient) {
      const key = `timesheets/${timesheetId}/${eventId}.json`;
      const blob = JSON.stringify({ note: 'large-payload', filler: 'x'.repeat(128 * 1024) });
      await minioClient.putObject(MINIO_BUCKET, key, blob, { 'Content-Type': 'application/json' });
      const url = `${MINIO_USE_SSL ? 'https' : 'http'}://${MINIO_ENDPOINT}:${MINIO_PORT}/${MINIO_BUCKET}/${key}`;
      payload.attachmentUrl = url;
    }
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
