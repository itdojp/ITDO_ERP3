import express from 'express';
import amqp from 'amqplib';
import { nanoid } from 'nanoid';
import Minio from 'minio';

const AMQP_URL = process.env.AMQP_URL || 'amqp://guest:guest@rabbitmq:5672';
const NUM_SHARDS = parseInt(process.env.NUM_SHARDS || '4', 10);
const PORT = parseInt(process.env.PORT || '3001', 10);
const USE_MINIO = (process.env.USE_MINIO || 'false').toLowerCase() === 'true';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'minio';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const MINIO_USE_SSL = (process.env.MINIO_USE_SSL || 'false').toLowerCase() === 'true';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'events';

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

async function ensureBucket(minioClient) {
  if (!USE_MINIO) return;
  const exists = await minioClient.bucketExists(MINIO_BUCKET).catch(() => false);
  if (!exists) await minioClient.makeBucket(MINIO_BUCKET, 'us-east-1');
}

async function main() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const { conn, ch } = await setupRabbit();
  const minioClient = new Minio.Client({ endPoint: MINIO_ENDPOINT, port: MINIO_PORT, useSSL: MINIO_USE_SSL, accessKey: MINIO_ACCESS_KEY, secretKey: MINIO_SECRET_KEY });
  if (USE_MINIO) await ensureBucket(minioClient);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // approve a timesheet and publish event
  app.post('/timesheets/approve', async (req, res) => {
    try {
      const { timesheetId, employeeId = 'E-001', projectId = 'P-001', hours = 8, rateType = 'standard', note } = req.body || {};
      if (!timesheetId) return res.status(400).json({ error: 'timesheetId required' });
      const idempotencyKey = req.header('Idempotency-Key') || nanoid();
      const eventId = nanoid();
      const payload = {
        eventId,
        occurredAt: new Date().toISOString(),
        tenantId: 'demo',
        timesheetId,
        employeeId,
        projectId,
        approvedBy: 'M-API',
        hours,
        rateType,
        idempotencyKey
      };
      if (USE_MINIO && note) {
        const key = `timesheets/${timesheetId}/${eventId}.json`;
        await minioClient.putObject(MINIO_BUCKET, key, JSON.stringify({ note }), { 'Content-Type': 'application/json' });
        payload.attachmentUrl = `${MINIO_USE_SSL ? 'https' : 'http'}://${MINIO_ENDPOINT}:${MINIO_PORT}/${MINIO_BUCKET}/${key}`;
      }
      const shard = shardFor(timesheetId);
      ch.publish('events', `shard.${shard}`, Buffer.from(JSON.stringify(payload)), {
        contentType: 'application/json', messageId: eventId, headers: { idempotencyKey, timesheetId }
      });
      res.status(202).json({ accepted: true, eventId, shard });
    } catch (e) {
      console.error('[pm-service] error', e);
      res.status(500).json({ error: 'internal' });
    }
  });

  // consume sales.order.confirmed -> publish pm.project.created
  for (let i = 0; i < NUM_SHARDS; i++) {
    const cch = await conn.createChannel();
    await cch.prefetch(1);
    const q = `shard.${i}`;
    cch.consume(q, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        if (payload.eventType === 'sales.order.confirmed') {
          const projectId = `PRJ-${payload.orderId}`;
          const event = {
            eventId: msg.properties.messageId + '.project',
            occurredAt: new Date().toISOString(),
            eventType: 'pm.project.created',
            tenantId: payload.tenantId,
            orderId: payload.orderId,
            projectId
          };
          cch.publish('events', `shard.${i}`, Buffer.from(JSON.stringify(event)), {
            contentType: 'application/json', messageId: event.eventId, headers: { orderId: payload.orderId }
          });
          console.log(`[pm-service] project created ${projectId} for order ${payload.orderId}`);
        }
        cch.ack(msg);
      } catch (e) {
        console.warn('[pm-service] consume error', e.message);
        cch.reject(msg, false);
      }
    });
  }

  app.listen(PORT, () => console.log(`[pm-service] listening on :${PORT}`));
  process.on('SIGINT', () => conn.close().finally(() => process.exit(0)));
}

main().catch((e) => { console.error('[pm-service] fatal', e); process.exit(1); });
