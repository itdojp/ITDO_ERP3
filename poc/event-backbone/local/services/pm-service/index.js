import express from 'express';
import amqp from 'amqplib';
import { nanoid } from 'nanoid';
import { Client as MinioClient } from 'minio';
import Redis from 'ioredis';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { projectSeed, timesheetSeed, invoiceSeed, filterInvoices } from './sample-data.js';

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

const cloneDeep = (value) => (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

const STATE_FILE = process.env.PM_STATE_FILE || path.resolve(process.cwd(), 'state', 'pm-poc-state.json');

const PROJECT_ACTIONS = new Set(['activate', 'hold', 'resume', 'close']);
const PROJECT_STATUS_TRANSITIONS = {
  planned: { activate: 'active', close: 'closed' },
  active: { hold: 'onhold', close: 'closed' },
  onhold: { resume: 'active', close: 'closed' },
  closed: {},
};

const TIMESHEET_ACTIONS = new Set(['submit', 'approve', 'reject', 'resubmit']);
const TIMESHEET_STATUS_TRANSITIONS = {
  draft: { submit: 'submitted' },
  submitted: { approve: 'approved', reject: 'rejected' },
  rejected: { resubmit: 'submitted' },
  approved: {},
};

function nextProjectStatus(current, action) {
  return PROJECT_STATUS_TRANSITIONS[current]?.[action] || null;
}

function nextTimesheetStatus(current, action) {
  return TIMESHEET_STATUS_TRANSITIONS[current]?.[action] || null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectRabbitWithRetry(context = 'pm-service') {
  let attempt = 0;
  while (true) {
    try {
      const conn = await amqp.connect(AMQP_URL);
      if (attempt > 0) {
        console.log(`[${context}] connected to RabbitMQ after ${attempt} retries`);
      }
      return conn;
    } catch (err) {
      attempt += 1;
      const delay = Math.min(10000, 1000 * attempt);
      console.warn(`[${context}] rabbitmq connect failed (attempt ${attempt}): ${err.message}. retry in ${delay}ms`);
      await sleep(delay);
    }
  }
}

function shardFor(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % NUM_SHARDS;
}

async function setupRabbit() {
  const conn = await connectRabbitWithRetry();
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

async function loadStateFromDisk() {
  try {
    if (!existsSync(STATE_FILE)) {
      return null;
    }
    const raw = await readFile(STATE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.warn('[pm-service] failed to load persisted state', error);
    return null;
  }
}

async function persistState({ projects, timesheets, invoices }) {
  try {
    await mkdir(path.dirname(STATE_FILE), { recursive: true });
    await writeFile(STATE_FILE, JSON.stringify({ projects, timesheets, invoices }, null, 2));
  } catch (error) {
    console.warn('[pm-service] failed to persist state', error);
  }
}

async function main() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  let projects = cloneDeep(projectSeed);
  let timesheets = cloneDeep(timesheetSeed);
  const invoices = cloneDeep(invoiceSeed);

  const restored = await loadStateFromDisk();
  if (restored) {
    if (Array.isArray(restored.projects)) {
      projects = restored.projects;
    }
    if (Array.isArray(restored.timesheets)) {
      timesheets = restored.timesheets;
    }
    if (Array.isArray(restored.invoices)) {
      invoices.splice(0, invoices.length, ...restored.invoices);
    }
  } else {
    void persistState({ projects, timesheets, invoices });
  }

  const { conn, ch } = await setupRabbit();
  const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
  const minioClient = new MinioClient({ endPoint: MINIO_ENDPOINT, port: MINIO_PORT, useSSL: MINIO_USE_SSL, accessKey: MINIO_ACCESS_KEY, secretKey: MINIO_SECRET_KEY });
  if (USE_MINIO) await ensureBucket(minioClient);

  const publishTimesheetApproved = async ({ timesheetId, employeeId = 'E-001', projectId = 'P-001', hours = 8, rateType = 'standard', note, idempotencyKey }) => {
    if (!timesheetId) {
      const error = new Error('timesheetId required');
      error.status = 400;
      throw error;
    }
    const resolvedKey = idempotencyKey || nanoid();
    const eventId = nanoid();
    const payload = {
      eventId,
      occurredAt: new Date().toISOString(),
      eventType: 'pm.timesheet.approved',
      tenantId: 'demo',
      timesheetId,
      employeeId,
      projectId,
      approvedBy: 'M-API',
      hours,
      rateType,
      idempotencyKey: resolvedKey,
    };
    if (USE_MINIO && note) {
      const storageKey = `timesheets/${timesheetId}/${eventId}.json`;
      await minioClient.putObject(MINIO_BUCKET, storageKey, JSON.stringify({ note }), { 'Content-Type': 'application/json' });
      payload.attachmentUrl = `${MINIO_USE_SSL ? 'https' : 'http'}://${MINIO_ENDPOINT}:${MINIO_PORT}/${MINIO_BUCKET}/${storageKey}`;
    }
    const shard = shardFor(timesheetId);
    ch.publish('events', `shard.${shard}`, Buffer.from(JSON.stringify(payload)), {
      contentType: 'application/json',
      messageId: eventId,
      headers: { idempotencyKey: resolvedKey, timesheetId },
    });
    await redis.incr('metrics:events:pm.timesheet.approved').catch(() => {});
    return { eventId, shard };
  };

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.get('/api/v1/projects', (req, res) => {
    const { status } = req.query || {};
    let items = projects;
    if (status && status !== 'all') {
      items = items.filter((project) => project.status === status);
    }
    res.json({ items });
  });

  app.post('/api/v1/projects/:projectId/:action', (req, res) => {
    const { projectId, action } = req.params;
    if (!PROJECT_ACTIONS.has(action)) {
      return res.status(400).json({ error: 'unsupported_action' });
    }
    const project = projects.find((item) => item.id === projectId || item.code === projectId);
    if (!project) {
      return res.status(404).json({ error: 'not_found' });
    }
    const nextStatus = nextProjectStatus(project.status, action);
    if (!nextStatus) {
      return res.status(409).json({ error: 'action_not_allowed' });
    }
    project.status = nextStatus;
    project.updatedAt = new Date().toISOString();
    if (nextStatus === 'closed' && !project.endOn) {
      project.endOn = new Date().toISOString().slice(0, 10);
    }
    void persistState({ projects, timesheets, invoices });
    res.json({ ok: true, item: project });
  });

  app.get('/api/v1/timesheets', (req, res) => {
    const { status, limit } = req.query || {};
    let items = timesheets;
    if (status && status !== 'all') {
      items = items.filter((entry) => entry.approvalStatus === status);
    }
    const parsedLimit = Number.parseInt(limit, 10);
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
      items = items.slice(0, parsedLimit);
    }
    res.json({ items });
  });

  app.post('/api/v1/timesheets/:timesheetId/:action', async (req, res) => {
    const { timesheetId, action } = req.params;
    if (!TIMESHEET_ACTIONS.has(action)) {
      return res.status(400).json({ error: 'unsupported_action' });
    }
    const entry = timesheets.find((item) => item.id === timesheetId);
    if (!entry) {
      return res.status(404).json({ error: 'not_found' });
    }
    const nextStatus = nextTimesheetStatus(entry.approvalStatus, action);
    if (!nextStatus) {
      return res.status(409).json({ error: 'action_not_allowed' });
    }
    const { comment, reasonCode } = req.body || {};
    const nowIso = new Date().toISOString();

    try {
      if (action === 'approve') {
        const { eventId, shard } = await publishTimesheetApproved({
          timesheetId: entry.id,
          employeeId: entry.employeeId || 'E-001',
          projectId: entry.projectId || entry.projectCode || 'P-001',
          hours: entry.hours ?? 8,
          rateType: entry.rateType || 'standard',
          note: comment,
          idempotencyKey: req.header('Idempotency-Key'),
        });
        entry.approvalStatus = nextStatus;
        entry.approvedAt = nowIso;
        if (comment) entry.note = comment;
        entry.updatedAt = nowIso;
        void persistState({ projects, timesheets, invoices });
        return res.json({ ok: true, item: entry, eventId, shard });
      }

      if (action === 'submit' || action === 'resubmit') {
        entry.submittedAt = nowIso;
        if (comment) entry.note = comment;
      }
      if (action === 'reject') {
        entry.note = comment || entry.note;
        if (reasonCode) entry.lastReasonCode = reasonCode;
      }
      entry.approvalStatus = nextStatus;
      entry.updatedAt = nowIso;
      void persistState({ projects, timesheets, invoices });
      res.json({ ok: true, item: entry });
    } catch (error) {
      console.error('[pm-service] timesheet action error', error);
      const status = error.status ?? 500;
      res.status(status).json({ error: status === 400 ? error.message : 'internal' });
    }
  });

  app.get('/api/v1/compliance/invoices', (req, res) => {
    const limitValue = Number.parseInt(req.query?.limit, 10);
    const filters = {
      keyword: req.query?.keyword,
      status: req.query?.status,
      startDate: req.query?.startDate || req.query?.issued_from,
      endDate: req.query?.endDate || req.query?.issued_to,
      minAmount: req.query?.minAmount || req.query?.min_total,
      maxAmount: req.query?.maxAmount || req.query?.max_total,
    };
    let items = filterInvoices(filters, invoices);
    if (Number.isFinite(limitValue) && limitValue > 0) {
      items = items.slice(0, limitValue);
    }
    res.json({
      items,
      meta: {
        total: items.length,
        fetchedAt: new Date().toISOString(),
        fallback: false,
      },
    });
  });

  // approve a timesheet and publish event
  app.post('/timesheets/approve', async (req, res) => {
    try {
      const { timesheetId, employeeId = 'E-001', projectId = 'P-001', hours = 8, rateType = 'standard', note } = req.body || {};
      const { eventId, shard } = await publishTimesheetApproved({
        timesheetId,
        employeeId,
        projectId,
        hours,
        rateType,
        note,
        idempotencyKey: req.header('Idempotency-Key'),
      });
      res.status(202).json({ accepted: true, eventId, shard });
    } catch (e) {
      console.error('[pm-service] error', e);
      const status = e.status ?? 500;
      res.status(status).json({ error: status === 400 ? e.message : 'internal' });
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
          await redis.incr('metrics:events:pm.project.created').catch(()=>{});
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

  // cancel a project (manual)
  app.post('/projects/:projectId/cancel', async (req, res) => {
    try {
      const { projectId } = req.params;
      const event = {
        eventId: `proj-cancel-${projectId}-${Date.now()}`,
        occurredAt: new Date().toISOString(),
        eventType: 'pm.project.cancelled',
        tenantId: 'demo',
        projectId
      };
      const shard = shardFor(projectId);
      const cch = await conn.createChannel();
      await cch.assertExchange('events', 'direct', { durable: true });
      cch.publish('events', `shard.${shard}`, Buffer.from(JSON.stringify(event)), { contentType: 'application/json', messageId: event.eventId });
      res.json({ ok: true, eventId: event.eventId });
    } catch (e) {
      console.error('[pm-service] cancel error', e);
      res.status(500).json({ error: 'internal' });
    }
  });
}

main().catch((e) => { console.error('[pm-service] fatal', e); process.exit(1); });
