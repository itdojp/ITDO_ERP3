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
const MINIO_PRESIGN_SECONDS = parseInt(process.env.MINIO_PRESIGN_SECONDS || '600', 10);
const MINIO_PUBLIC_ENDPOINT = process.env.MINIO_PUBLIC_ENDPOINT || 'localhost';
const MINIO_PUBLIC_PORT = parseInt(process.env.MINIO_PUBLIC_PORT || String(MINIO_PORT), 10);
const MINIO_MAX_RETRIES = parseInt(process.env.MINIO_MAX_RETRIES || '3', 10);
const MINIO_RETRY_BACKOFF_MS = parseInt(process.env.MINIO_RETRY_BACKOFF_MS || '500', 10);

const cloneDeep = (value) => (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

const STATE_FILE = process.env.PM_STATE_FILE || path.resolve(process.cwd(), 'state', 'pm-poc-state.json');

const METRICS_CACHE_MS = parseInt(process.env.METRICS_CACHE_MS || '5000', 10);

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

const countByKey = (items, key) =>
  items.reduce((acc, item) => {
    const value = item[key] ?? 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

const buildMinioObjectUrl = (key) =>
  `${MINIO_USE_SSL ? 'https' : 'http'}://${MINIO_PUBLIC_ENDPOINT}:${MINIO_PUBLIC_PORT}/${MINIO_BUCKET}/${key}`;

const rewriteToPublicUrl = (url) => {
  try {
    const parsed = new URL(url);
    parsed.protocol = MINIO_USE_SSL ? 'https' : 'http';
    parsed.hostname = MINIO_PUBLIC_ENDPOINT;
    parsed.port = String(MINIO_PUBLIC_PORT);
    return parsed.toString();
  } catch (error) {
    console.warn('[pm-service] failed to rewrite MinIO URL', { url, error: error.message });
    return url;
  }
};

async function ensureObject(minioClient, key, contents, metadata = {}) {
  for (let attempt = 1; attempt <= MINIO_MAX_RETRIES; attempt++) {
    try {
      await minioClient.statObject(MINIO_BUCKET, key);
      return;
    } catch (error) {
      if (error.code && error.code !== 'NotFound') {
        console.warn(`[pm-service] statObject failed for ${key} (attempt ${attempt}): ${error.message}`);
        if (attempt === MINIO_MAX_RETRIES) throw error;
        await sleep(MINIO_RETRY_BACKOFF_MS * attempt);
        continue;
      }
    }

    try {
      const buffer = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
      await minioClient.putObject(MINIO_BUCKET, key, buffer, {
        'Content-Type': metadata.contentType || 'application/json',
      });
      console.info(`[pm-service] seeded MinIO object ${key}`);
      return;
    } catch (error) {
      console.warn(`[pm-service] putObject failed for ${key} (attempt ${attempt}): ${error.message}`);
      if (attempt === MINIO_MAX_RETRIES) throw error;
      await sleep(MINIO_RETRY_BACKOFF_MS * attempt);
    }
  }
}

async function ensureComplianceAttachmentObjects(minioClient, invoices) {
  if (!USE_MINIO) return;
  console.info('[pm-service] ensuring MinIO compliance attachments');
  for (const invoice of invoices) {
    for (const attachment of invoice.attachments) {
      const key = attachment.storageKey || `compliance/${invoice.id}/${attachment.fileName}`;
      attachment.storageKey = key;
      const payload = JSON.stringify({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        attachmentId: attachment.id,
        generatedAt: new Date().toISOString(),
        note: 'Seeded attachment placeholder for MinIO integration.',
      });
      try {
        await ensureObject(minioClient, key, payload, { contentType: 'application/json' });
      } catch (error) {
        console.error('[pm-service] failed to seed MinIO attachment object', { key, error });
        throw error;
      }
    }
  }
}

async function attachMinioDownloadUrls(minioClient, invoices) {
  if (!USE_MINIO) return invoices;
  await Promise.all(
    invoices.map(async (invoice) => {
      await Promise.all(
        invoice.attachments.map(async (attachment) => {
          const key = attachment.storageKey || `compliance/${invoice.id}/${attachment.fileName}`;
          attachment.storageKey = key;
          try {
            const url = await minioClient.presignedGetObject(MINIO_BUCKET, key, MINIO_PRESIGN_SECONDS);
            attachment.downloadUrl = rewriteToPublicUrl(url);
          } catch (error) {
            console.warn('[pm-service] failed to presign attachment', { key, error: error.message });
            attachment.downloadUrl = buildMinioObjectUrl(key);
          }
        }),
      );
    }),
  );
  return invoices;
}

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

async function persistState({ projects, timesheets, invoices, events }) {
  try {
    await mkdir(path.dirname(STATE_FILE), { recursive: true });
    await writeFile(STATE_FILE, JSON.stringify({ projects, timesheets, invoices, events }, null, 2));
  } catch (error) {
    console.warn('[pm-service] failed to persist state', error);
  }
}

async function main() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  let projects = cloneDeep(projectSeed);
  let timesheets = cloneDeep(timesheetSeed);
  let invoices = cloneDeep(invoiceSeed);
  let eventLog = [];

  const sseClients = new Set();
  let metricsSnapshot = null;

  const computeMetricsSnapshot = () => ({
    computedAt: Date.now(),
    data: {
      projects: countByKey(projects, 'status'),
      timesheets: countByKey(timesheets, 'approvalStatus'),
      invoices: countByKey(invoices, 'status'),
      events: eventLog.length,
    },
  });

  const getMetricsSnapshot = (force = false) => {
    if (!metricsSnapshot || force || Date.now() - metricsSnapshot.computedAt > METRICS_CACHE_MS) {
      metricsSnapshot = computeMetricsSnapshot();
    }
    return metricsSnapshot;
  };

  const broadcastMetrics = () => {
    if (sseClients.size === 0) return;
    const snapshot = getMetricsSnapshot();
    const payload = JSON.stringify({
      ...snapshot.data,
      cachedAt: new Date(snapshot.computedAt).toISOString(),
      cacheTtlMs: METRICS_CACHE_MS,
    });
    const message = `data: ${payload}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(message);
      } catch (error) {
        console.warn('[pm-service] SSE write failed', error);
        sseClients.delete(client);
        try {
          client.end();
        } catch (err) {
          console.warn('[pm-service] SSE client close failed', err);
        }
      }
    }
  };

  const persistSnapshot = () =>
    persistState({ projects, timesheets, invoices, events: eventLog })
      .then(() => {
        getMetricsSnapshot(true);
        broadcastMetrics();
      })
      .catch((err) => console.error('[pm-service] persistState error', err));

  const restored = await loadStateFromDisk();
  if (restored) {
    if (Array.isArray(restored.projects)) {
      projects = cloneDeep(restored.projects);
    }
    if (Array.isArray(restored.timesheets)) {
      timesheets = cloneDeep(restored.timesheets);
    }
    if (Array.isArray(restored.invoices)) {
      invoices = cloneDeep(restored.invoices);
    }
    if (Array.isArray(restored.events)) {
      eventLog = cloneDeep(restored.events);
    }
  } else {
    persistSnapshot();
  }

  getMetricsSnapshot(true);

  const { conn, ch } = await setupRabbit();
  const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
  const minioClient = new MinioClient({ endPoint: MINIO_ENDPOINT, port: MINIO_PORT, useSSL: MINIO_USE_SSL, accessKey: MINIO_ACCESS_KEY, secretKey: MINIO_SECRET_KEY });
  if (USE_MINIO) await ensureBucket(minioClient);
  if (USE_MINIO) await ensureComplianceAttachmentObjects(minioClient, invoices);

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
    const record = {
      ...payload,
      storedAt: new Date().toISOString(),
    };
    eventLog.push(record);
    if (eventLog.length > 100) {
      eventLog = eventLog.slice(-100);
    }
    persistSnapshot();
    return { eventId, shard };
  };

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.get('/api/v1/projects', (req, res) => {
    const { status } = req.query || {};
    let items = projects;
    if (status && status !== 'all') {
      items = items.filter((project) => project.status === status);
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
    persistSnapshot();
    res.json({ ok: true, item: project });
  });

  app.post('/api/v1/projects', (req, res) => {
    const { code, name, clientName, status = 'planned', startOn, endOn, manager, health = 'green', tags = [] } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'name required' });
    }
    const projectId = req.body?.id || `PRJ-${nanoid(6)}`;
    if (projects.some((item) => item.id === projectId || (code && item.code === code))) {
      return res.status(409).json({ error: 'duplicate_project' });
    }
    const createdAt = new Date().toISOString();
    const created = {
      id: projectId,
      code: code || projectId,
      name,
      clientName: clientName || 'Internal',
      status,
      startOn: startOn || createdAt.slice(0, 10),
      endOn: endOn || null,
      manager: manager || null,
      health,
      tags,
      createdAt,
      updatedAt: createdAt,
    };
    projects.push(created);
    persistSnapshot();
    res.status(201).json({ ok: true, item: created });
  });

  app.get('/api/v1/timesheets', (req, res) => {
    const { status, limit } = req.query || {};
    const statusFilter = status && status !== 'all' ? status : 'all';
    let items = timesheets;
    if (statusFilter !== 'all') {
      items = items.filter((entry) => entry.approvalStatus === statusFilter);
    }
    const parsedLimit = Number.parseInt(limit, 10);
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
      items = items.slice(0, parsedLimit);
    }
    res.json({
      items,
      meta: {
        total: timesheets.length,
        returned: items.length,
        fetchedAt: new Date().toISOString(),
        fallback: false,
        status: statusFilter,
      },
    });
  });

  app.post('/api/v1/timesheets', (req, res) => {
    const { userName, projectId, projectCode, projectName, workDate, hours = 8, note, rateType = 'standard' } = req.body || {};
    if (!userName || !(projectId || projectCode)) {
      return res.status(400).json({ error: 'userName and projectId/projectCode are required' });
    }
    const id = req.body?.id || `TS-${nanoid(6)}`;
    if (timesheets.some((item) => item.id === id)) {
      return res.status(409).json({ error: 'duplicate_timesheet' });
    }
    const createdAt = new Date().toISOString();
    const created = {
      id,
      userName,
      employeeId: req.body?.employeeId || `EMP-${nanoid(4)}`,
      projectId: projectId || projectCode,
      projectCode: projectCode || projectId || id,
      projectName: projectName || 'Untitled Project',
      taskName: req.body?.taskName || null,
      workDate: workDate || createdAt.slice(0, 10),
      hours,
      approvalStatus: 'draft',
      note: note || null,
      rateType,
      createdAt,
      updatedAt: createdAt,
    };
    timesheets.push(created);
    persistSnapshot();
    res.status(201).json({ ok: true, item: created });
  });

  app.delete('/api/v1/timesheets/:timesheetId', (req, res) => {
    const { timesheetId } = req.params;
    const next = timesheets.filter((item) => item.id !== timesheetId);
    if (next.length === timesheets.length) {
      return res.status(404).json({ error: 'not_found' });
    }
    timesheets = next;
    persistSnapshot();
    res.json({ ok: true });
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
        persistSnapshot();
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
      persistSnapshot();
      res.json({ ok: true, item: entry });
    } catch (error) {
      console.error('[pm-service] timesheet action error', error);
      const status = error.status ?? 500;
      res.status(status).json({ error: status === 400 ? error.message : 'internal' });
    }
  });

  app.get('/api/v1/compliance/invoices', async (req, res) => {
    const filters = {
      keyword: req.query?.keyword,
      status: req.query?.status,
      startDate: req.query?.startDate || req.query?.issued_from,
      endDate: req.query?.endDate || req.query?.issued_to,
      minAmount: req.query?.minAmount || req.query?.min_total,
      maxAmount: req.query?.maxAmount || req.query?.max_total,
    };

    const sortKey = typeof req.query?.sort_by === 'string' ? req.query.sort_by : 'issueDate';
    const sortBy = ['issueDate', 'updatedAt', 'amount'].includes(sortKey) ? sortKey : 'issueDate';
    const sortDirParam = typeof req.query?.sort_dir === 'string' ? req.query.sort_dir.toLowerCase() : 'desc';
    const sortDir = sortDirParam === 'asc' ? 'asc' : 'desc';

    const rawPage = Number.parseInt(req.query?.page, 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

    const rawPageSize =
      Number.parseInt(req.query?.page_size, 10) ||
      Number.parseInt(req.query?.pageSize, 10) ||
      Number.parseInt(req.query?.limit, 10);
    const pageSize = Math.max(5, Math.min(Number.isFinite(rawPageSize) && rawPageSize > 0 ? rawPageSize : 25, 100));

    const filtered = filterInvoices(filters, invoices);
    const total = filtered.length;

    const sorted = filtered.slice().sort((a, b) => {
      let delta = 0;
      if (sortBy === 'updatedAt') {
        const aTime = new Date(a.updatedAt ?? a.issueDate ?? 0).getTime();
        const bTime = new Date(b.updatedAt ?? b.issueDate ?? 0).getTime();
        delta = aTime - bTime;
      } else if (sortBy === 'amount') {
        delta = (a.amountIncludingTax ?? 0) - (b.amountIncludingTax ?? 0);
      } else {
        const aTime = Date.parse(`${a.issueDate}T00:00:00Z`);
        const bTime = Date.parse(`${b.issueDate}T00:00:00Z`);
        delta = (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
      }
      return sortDir === 'asc' ? delta : -delta;
    });

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const slice = sorted.slice(startIndex, startIndex + pageSize);
    let payloadItems = cloneDeep(slice);
    if (USE_MINIO) {
      try {
        payloadItems = await attachMinioDownloadUrls(minioClient, payloadItems);
      } catch (error) {
        console.warn('[pm-service] failed to attach MinIO download URLs', error);
      }
    }

    res.json({
      items: payloadItems,
      meta: {
        total,
        page: currentPage,
        pageSize,
        totalPages,
        sortBy,
        sortDir,
        fetchedAt: new Date().toISOString(),
        fallback: false,
      },
    });
  });

  app.get('/metrics/summary', (req, res) => {
    const refresh = String(req.query?.refresh ?? '').toLowerCase() === 'true';
    const snapshot = getMetricsSnapshot(refresh);
    if (refresh) broadcastMetrics();
    const now = Date.now();
    const stale = now - snapshot.computedAt > METRICS_CACHE_MS;
    res.json({
      ...snapshot.data,
      cachedAt: new Date(snapshot.computedAt).toISOString(),
      cacheTtlMs: METRICS_CACHE_MS,
      stale,
    });
  });

  app.get('/metrics/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);
    const snapshot = getMetricsSnapshot(false);
    res.write(
      `data: ${JSON.stringify({
        ...snapshot.data,
        cachedAt: new Date(snapshot.computedAt).toISOString(),
        cacheTtlMs: METRICS_CACHE_MS,
      })}\n\n`,
    );

    req.on('close', () => {
      sseClients.delete(res);
      try {
        res.end();
      } catch (error) {
        console.warn('[pm-service] SSE close error', error);
      }
    });
  });

  app.get('/events/recent', (req, res) => {
    const limit = Number.parseInt(req.query?.limit, 10) || 20;
    const items = eventLog.slice(-limit).reverse();
    res.json({ items });
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
