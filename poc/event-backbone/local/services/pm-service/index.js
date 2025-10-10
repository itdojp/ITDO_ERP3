import express from 'express';
import amqp from 'amqplib';
import { nanoid } from 'nanoid';
import { Client as MinioClient } from 'minio';
import Redis from 'ioredis';
import { readFile, writeFile, mkdir, appendFile, rename, stat, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { graphqlHTTP } from 'express-graphql';
import { projectSeed, timesheetSeed, invoiceSeed, telemetrySeed, filterInvoices } from './sample-data.js';
import { createGraphQLSchema } from './graphql-schema.js';

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
const TELEMETRY_LOG_PATH = process.env.TELEMETRY_LOG_PATH || path.resolve(process.cwd(), 'state', 'telemetry.log');
const TELEMETRY_MAX_LOG_BYTES = Math.max(1024, parseInt(process.env.TELEMETRY_MAX_LOG_BYTES || String(5 * 1024 * 1024), 10));
const TELEMETRY_LOG_MAX_ARCHIVES = Math.max(1, parseInt(process.env.TELEMETRY_LOG_MAX_ARCHIVES || '3', 10));
const TELEMETRY_DEFAULT_LIMIT = Math.max(1, parseInt(process.env.TELEMETRY_DEFAULT_LIMIT || '50', 10));
const TELEMETRY_MAX_LIMIT = Math.max(1, parseInt(process.env.TELEMETRY_MAX_LIMIT || '200', 10));
const TELEMETRY_DATE_FIELDS = ['since', 'from', 'start', 'after'];
const TELEMETRY_END_DATE_FIELDS = ['until', 'to', 'end', 'before'];
const TELEMETRY_SEED_DISABLED = (process.env.TELEMETRY_SEED_DISABLE || 'false').toLowerCase() === 'true';
const TELEMETRY_SEED_RETRY_ATTEMPTS = Math.max(0, parseInt(process.env.TELEMETRY_SEED_RETRY_ATTEMPTS || '3', 10));
const TELEMETRY_SEED_RETRY_DELAY_MS = Math.max(0, parseInt(process.env.TELEMETRY_SEED_RETRY_DELAY_MS || '3000', 10));

const METRICS_CACHE_MS = parseInt(process.env.METRICS_CACHE_MS || '5000', 10);
const IDEMP_TTL_MS = Math.max(0, parseInt(process.env.IDEMP_TTL_MS || String(24 * 60 * 60 * 1000), 10));

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

async function rotateTelemetryLogIfNeeded() {
  if (!TELEMETRY_LOG_PATH) return;
  try {
    const info = await stat(TELEMETRY_LOG_PATH).catch(() => null);
    if (!info || info.size < TELEMETRY_MAX_LOG_BYTES) {
      return;
    }
    const dir = path.dirname(TELEMETRY_LOG_PATH);
    const base = path.basename(TELEMETRY_LOG_PATH);
    await rm(path.join(dir, `${base}.${TELEMETRY_LOG_MAX_ARCHIVES}`), { force: true }).catch(() => {});
    for (let index = TELEMETRY_LOG_MAX_ARCHIVES - 1; index >= 1; index -= 1) {
      const src = path.join(dir, `${base}.${index}`);
      const dest = path.join(dir, `${base}.${index + 1}`);
      await rm(dest, { force: true }).catch(() => {});
      await rename(src, dest).catch(() => {});
    }
    const firstArchive = path.join(dir, `${base}.1`);
    await rm(firstArchive, { force: true }).catch(() => {});
    await rename(TELEMETRY_LOG_PATH, firstArchive).catch(() => {});
  } catch (error) {
    console.warn('[telemetry] failed to rotate log', error);
  }
}

async function appendTelemetryLogEntry(entry) {
  if (!TELEMETRY_LOG_PATH) return;
  try {
    await mkdir(path.dirname(TELEMETRY_LOG_PATH), { recursive: true });
    await rotateTelemetryLogIfNeeded();
    await appendFile(TELEMETRY_LOG_PATH, `${JSON.stringify(entry)}\n`);
  } catch (error) {
    console.warn('[telemetry] failed to append log', error);
  }
}

function parseTelemetryLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return TELEMETRY_DEFAULT_LIMIT;
  return Math.min(parsed, TELEMETRY_MAX_LIMIT);
}

function parseTelemetryOffset(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

const toLowerSafe = (value) => (typeof value === 'string' ? value.toLowerCase() : undefined);

const includesText = (value, filter) => {
  if (!filter) return true;
  if (value === null || value === undefined) return false;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value).toLowerCase().includes(filter);
    } catch (error) {
      return String(value).toLowerCase().includes(filter);
    }
  }
  return String(value).toLowerCase().includes(filter);
};

const safeStringify = (value) => {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
};

const parseDetailPath = (expression) => {
  if (typeof expression !== 'string') return [];
  let input = expression.trim();
  if (!input) return [];
  if (input.startsWith('$')) {
    input = input.slice(1);
    if (input.startsWith('.')) {
      input = input.slice(1);
    }
  }

  const tokens = [];
  let buffer = '';
  let index = 0;

  const pushBuffer = () => {
    const candidate = buffer.trim();
    if (candidate.length > 0) {
      tokens.push({ type: 'key', value: candidate });
    }
    buffer = '';
  };

  while (index < input.length) {
    const char = input[index];
    if (char === '.') {
      pushBuffer();
      index += 1;
      continue;
    }
    if (char === '[') {
      pushBuffer();
      const end = input.indexOf(']', index);
      if (end === -1) {
        buffer += input.slice(index);
        break;
      }
      const inner = input.slice(index + 1, end).trim();
      if (inner === '*' || inner === '.*') {
        tokens.push({ type: 'wildcard' });
      } else if (
        (inner.startsWith('"') && inner.endsWith('"')) ||
        (inner.startsWith("'") && inner.endsWith("'"))
      ) {
        tokens.push({ type: 'key', value: inner.slice(1, -1) });
      } else if (/^-?\d+$/.test(inner)) {
        tokens.push({ type: 'index', value: Number.parseInt(inner, 10) });
      } else if (inner.length > 0) {
        tokens.push({ type: 'key', value: inner });
      }
      index = end + 1;
      continue;
    }
    buffer += char;
    index += 1;
  }

  pushBuffer();
  return tokens;
};

const extractValuesAtDetailPath = (source, tokens) => {
  if (!tokens || tokens.length === 0) {
    return [source];
  }
  let current = [source];
  for (const token of tokens) {
    const next = [];
    for (const entry of current) {
      if (entry === null || entry === undefined) continue;
      if (token.type === 'wildcard') {
        if (Array.isArray(entry)) {
          next.push(...entry);
        } else if (typeof entry === 'object') {
          next.push(...Object.values(entry));
        }
        continue;
      }
      if (token.type === 'index') {
        if (Array.isArray(entry) && token.value >= 0 && token.value < entry.length) {
          next.push(entry[token.value]);
        }
        continue;
      }
      if (typeof entry === 'object' && entry !== null && token.value in entry) {
        next.push(entry[token.value]);
      }
    }
    current = next;
    if (current.length === 0) {
      break;
    }
  }
  return current;
};

const matchesDetailFilter = (detail, filter, tokens) => {
  if (!filter) return true;
  if (tokens && tokens.length > 0) {
    if (!detail || typeof detail !== 'object') {
      return false;
    }
    const values = extractValuesAtDetailPath(detail, tokens);
    if (values.length === 0) {
      return false;
    }
    return values.some((value) => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'object') {
        return includesText(safeStringify(value), filter);
      }
      return includesText(value, filter);
    });
  }
  if (detail === null || detail === undefined) {
    return false;
  }
  if (typeof detail === 'object') {
    return includesText(safeStringify(detail), filter);
  }
  return includesText(detail, filter);
};

const parseTelemetryDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const resolveTimestamp = (item) => {
  const source = item?.receivedAt || item?.timestamp;
  if (!source) return null;
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const TELEMETRY_SORT_FIELDS = new Set(['receivedAt', 'timestamp', 'component', 'event', 'level', 'origin']);
const TELEMETRY_SORT_ORDERS = new Set(['asc', 'desc']);

async function buildComplianceInvoicesResponse(params = {}, attachContext = null, sourceInvoices = invoiceSeed) {
  const dataset = Array.isArray(sourceInvoices) ? sourceInvoices : [];
  const filters = {
    keyword: params.keyword ?? params.search,
    status: params.status,
    startDate: params.startDate ?? params.issued_from,
    endDate: params.endDate ?? params.issued_to,
    minAmount: params.minAmount ?? params.min_total,
    maxAmount: params.maxAmount ?? params.max_total,
  };

  const sortCandidate =
    typeof params.sortBy === 'string'
      ? params.sortBy
      : typeof params.sort_by === 'string'
        ? params.sort_by
        : undefined;
  const sortBy = ['issueDate', 'updatedAt', 'amount'].includes(sortCandidate) ? sortCandidate : 'issueDate';
  const sortDirParam = String(params.sortDir ?? params.sort_dir ?? '').toLowerCase();
  const sortDir = sortDirParam === 'asc' ? 'asc' : 'desc';

  const parseNumber = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const rawPage = parseNumber(params.page);
  const page = rawPage && rawPage > 0 ? rawPage : 1;

  const rawPageSize =
    parseNumber(params.pageSize) ??
    parseNumber(params.page_size) ??
    parseNumber(params.limit);
  const pageSize = Math.max(5, Math.min(rawPageSize && rawPageSize > 0 ? rawPageSize : 25, 100));

  const filtered = filterInvoices(filters, dataset);
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
  const pageSlice = sorted.slice(startIndex, startIndex + pageSize);
  let payloadItems = cloneDeep(pageSlice);
  if (USE_MINIO && attachContext && typeof attachContext.attach === 'function' && payloadItems.length > 0) {
    try {
      payloadItems = await attachContext.attach(payloadItems);
    } catch (error) {
      console.warn('[pm-service] failed to attach MinIO download URLs (graphql)', error);
    }
  }

  return {
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
  };
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
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  let projects = cloneDeep(projectSeed);
  let timesheets = cloneDeep(timesheetSeed);
  let invoices = cloneDeep(invoiceSeed);
  let eventLog = [];
  let telemetryLog = [];

  const ingestTelemetryEvent = (payload, options = {}) => {
    const base =
      typeof payload === 'object' && payload !== null
        ? payload
        : { detail: { message: String(payload ?? 'invalid payload') } };
    const {
      source = 'ui:ingest',
      ip = base.ip ?? '127.0.0.1',
      timestamp,
    } = options;
    const resolvedTimestamp = timestamp ?? base.timestamp ?? new Date().toISOString();
    const enriched = {
      ...base,
      timestamp: base.timestamp ?? resolvedTimestamp,
      receivedAt: base.receivedAt ?? resolvedTimestamp,
      ip,
    };
    telemetryLog.push(enriched);
    if (telemetryLog.length > 200) {
      telemetryLog = telemetryLog.slice(-200);
    }
    console.info(`[telemetry:${source}]`, JSON.stringify(enriched));
    void appendTelemetryLogEntry(enriched);
    return enriched;
  };

  const telemetrySeedAvailable = () => Array.isArray(telemetrySeed) && telemetrySeed.length > 0;

  const seedTelemetryIfNeeded = () => {
    if (TELEMETRY_SEED_DISABLED) {
      console.info('[telemetry] seed skipped (TELEMETRY_SEED_DISABLE=true)');
      return;
    }
    if (!telemetrySeedAvailable()) {
      return;
    }
    if (telemetryLog.length > 0) {
      return;
    }
    const now = Date.now();
    telemetrySeed.forEach((entry, index) => {
      const baseDetail =
        entry && typeof entry.detail === 'object' && entry.detail !== null
          ? cloneDeep(entry.detail)
          : entry?.detail !== undefined
            ? { message: String(entry.detail) }
            : {};
      const timestamp = new Date(now - (telemetrySeed.length - index) * 1500).toISOString();
      ingestTelemetryEvent(
        {
          ...entry,
          detail: {
            ...baseDetail,
            seeded: true,
          },
        },
        {
          source: 'seed',
          ip: 'seed::pm-service',
          timestamp,
        },
      );
    });
    console.info(`[telemetry] seeded ${telemetrySeed.length} sample events`);
  };

  const scheduleTelemetrySeedRetry = () => {
    if (
      TELEMETRY_SEED_DISABLED ||
      TELEMETRY_SEED_RETRY_ATTEMPTS <= 0 ||
      !telemetrySeedAvailable()
    ) {
      return;
    }
    let attempts = 0;
    const attemptSeed = () => {
      if (telemetryLog.length > 0) {
        return;
      }
      attempts += 1;
      console.warn(
        `[telemetry] log empty after startup, retrying seed (${attempts}/${TELEMETRY_SEED_RETRY_ATTEMPTS})`,
      );
      seedTelemetryIfNeeded();
      const stillEmpty = telemetryLog.length === 0;
      if (stillEmpty && attempts < TELEMETRY_SEED_RETRY_ATTEMPTS) {
        setTimeout(attemptSeed, TELEMETRY_SEED_RETRY_DELAY_MS);
        return;
      }
      if (stillEmpty) {
        console.error('[telemetry] failed to seed sample events after retries');
      }
    };
    setTimeout(attemptSeed, TELEMETRY_SEED_RETRY_DELAY_MS);
  };

  seedTelemetryIfNeeded();
  scheduleTelemetrySeedRetry();

  const projectIdempotencyFallback = new Map();
  const timesheetIdempotencyFallback = new Map();

  const sseClients = new Set();
  let metricsSnapshot = null;

  const computeMetricsSnapshot = () => ({
    computedAt: Date.now(),
    data: {
      projects: countByKey(projects, 'status'),
      timesheets: countByKey(timesheets, 'approvalStatus'),
      invoices: countByKey(invoices, 'status'),
      events: eventLog.length,
      idempotency: {
        projectKeys: projectIdempotencyFallback.size,
        timesheetKeys: timesheetIdempotencyFallback.size,
      },
    },
  });

  const getMetricsSnapshot = (force = false) => {
    if (!metricsSnapshot || force || Date.now() - metricsSnapshot.computedAt > METRICS_CACHE_MS) {
      metricsSnapshot = computeMetricsSnapshot();
    }
    return metricsSnapshot;
  };

  const buildMetricsPayload = (snapshot) => ({
    ...snapshot.data,
    cachedAt: new Date(snapshot.computedAt).toISOString(),
    cacheTtlMs: METRICS_CACHE_MS,
    stale: Date.now() - snapshot.computedAt > METRICS_CACHE_MS,
  });

  const logMetricsSnapshot = (snapshot, reason = 'persist') => {
    console.info('[metrics:snapshot]', JSON.stringify({
      type: 'metrics-summary',
      reason,
      cachedAt: new Date(snapshot.computedAt).toISOString(),
      cacheTtlMs: METRICS_CACHE_MS,
      ...snapshot.data,
    }));
  };

  const broadcastMetrics = (snapshotOverride) => {
    if (sseClients.size === 0) return;
    const snapshot = snapshotOverride ?? getMetricsSnapshot();
    const payload = JSON.stringify(buildMetricsPayload(snapshot));
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
        const snapshot = getMetricsSnapshot(true);
        logMetricsSnapshot(snapshot, 'persist');
        broadcastMetrics(snapshot);
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
  const PROJECT_IDEMP_PREFIX = 'pm:idempotency:project:';
  const TIMESHEET_IDEMP_PREFIX = 'pm:idempotency:timesheet:';

  const projectIdempotencyStore = {
    async get(key) {
      if (!key) return null;
      const fallback = projectIdempotencyFallback.get(key) || null;
      try {
        const value = await redis.get(PROJECT_IDEMP_PREFIX + key);
        return value || fallback;
      } catch (error) {
        console.warn('[idempotency] redis get project failed', error);
        return fallback;
      }
    },
    async set(key, value) {
      if (!key || !value) return;
      projectIdempotencyFallback.set(key, value);
      try {
        if (IDEMP_TTL_MS > 0) {
          await redis.set(PROJECT_IDEMP_PREFIX + key, value, 'PX', IDEMP_TTL_MS);
        } else {
          await redis.set(PROJECT_IDEMP_PREFIX + key, value);
        }
      } catch (error) {
        console.warn('[idempotency] redis set project failed', error);
      }
    },
  };

  const timesheetIdempotencyStore = {
    async get(key) {
      if (!key) return null;
      const fallback = timesheetIdempotencyFallback.get(key) || null;
      try {
        const value = await redis.get(TIMESHEET_IDEMP_PREFIX + key);
        return value || fallback;
      } catch (error) {
        console.warn('[idempotency] redis get timesheet failed', error);
        return fallback;
      }
    },
    async set(key, value) {
      if (!key || !value) return;
      timesheetIdempotencyFallback.set(key, value);
      try {
        if (IDEMP_TTL_MS > 0) {
          await redis.set(TIMESHEET_IDEMP_PREFIX + key, value, 'PX', IDEMP_TTL_MS);
        } else {
          await redis.set(TIMESHEET_IDEMP_PREFIX + key, value);
        }
      } catch (error) {
        console.warn('[idempotency] redis set timesheet failed', error);
      }
    },
  };
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

  const schema = createGraphQLSchema({
    projects,
    timesheets,
    invoices,
    eventLog,
    getMetricsSnapshot,
    buildMetricsPayload,
    logMetricsSnapshot,
    broadcastMetrics,
    persistSnapshot,
    publishTimesheetApproved,
    attachDownloadUrls: async (items) => attachMinioDownloadUrls(minioClient, items),
    filterInvoices,
    buildComplianceInvoicesResponse: (params, attachContext) =>
      buildComplianceInvoicesResponse(params, attachContext, invoices),
    projectActions: PROJECT_ACTIONS,
    timesheetActions: TIMESHEET_ACTIONS,
    nextProjectStatus,
    nextTimesheetStatus,
    useMinio: USE_MINIO,
    projectIdempotencyStore,
    timesheetIdempotencyStore,
  });

  app.use(
    '/graphql',
    graphqlHTTP({
      schema,
      graphiql: process.env.NODE_ENV !== 'production',
      customFormatErrorFn: (error) => {
        console.warn('[graphql] error', {
          message: error.message,
          path: error.path,
          locations: error.locations,
        });
        return {
          message: error.message,
          locations: error.locations,
          path: error.path,
        };
      },
    }),
  );

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

  app.post('/api/v1/projects', async (req, res) => {
    const { code, name, clientName, status = 'planned', startOn, endOn, manager, health = 'green', tags = [] } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'name required' });
    }
    const projectId = req.body?.id || `PRJ-${nanoid(6)}`;
    const idempotencyKeyHeader = (req.header('Idempotency-Key') || req.body?.idempotencyKey || '').trim();
    if (idempotencyKeyHeader) {
      const existingId = await projectIdempotencyStore.get(idempotencyKeyHeader);
      if (existingId) {
        const existing = projects.find((item) => item.id === existingId || item.code === existingId);
        if (existing) {
          return res.json({ ok: true, item: existing, idempotent: true });
        }
      }
    }
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
    if (idempotencyKeyHeader) {
      await projectIdempotencyStore.set(idempotencyKeyHeader, created.id);
    }
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

  app.post('/api/v1/timesheets', async (req, res) => {
    const { userName, projectId, projectCode, projectName, workDate, hours = 8, note, rateType = 'standard' } = req.body || {};
    if (!userName || !(projectId || projectCode)) {
      return res.status(400).json({ error: 'userName and projectId/projectCode are required' });
    }
    const id = req.body?.id || `TS-${nanoid(6)}`;
    const idempotencyKeyHeader = (req.header('Idempotency-Key') || req.body?.idempotencyKey || '').trim();
    if (idempotencyKeyHeader) {
      const existingId = await timesheetIdempotencyStore.get(idempotencyKeyHeader);
      if (existingId) {
        const existing = timesheets.find((item) => item.id === existingId);
        if (existing) {
          return res.json({ ok: true, item: existing, idempotent: true });
        }
      }
    }
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
    if (idempotencyKeyHeader) {
      await timesheetIdempotencyStore.set(idempotencyKeyHeader, created.id);
    }
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
    try {
      const result = await buildComplianceInvoicesResponse(
        req.query,
        USE_MINIO
          ? {
              attach: (items) => attachMinioDownloadUrls(minioClient, items),
            }
          : null,
        invoices,
      );
      res.json(result);
    } catch (error) {
      console.error('[pm-service] compliance invoices error', error);
      res.status(500).json({ error: 'internal' });
    }
  });

  app.post('/api/v1/telemetry/ui', (req, res) => {
    const payload = (typeof req.body === 'object' && req.body) || {};
    ingestTelemetryEvent(payload, { source: 'ui:ingest', ip: req.ip });
    res.status(204).end();
  });

  app.get('/api/v1/telemetry/ui', (req, res) => {
    const query = req.query || {};
    const componentFilter = toLowerSafe(query.component ?? query.components ?? query.component_like);
    const eventFilter = toLowerSafe(query.event ?? query.events ?? query.keyword);
    const levelFilter = toLowerSafe(query.level ?? query.levels);
    const originFilter = toLowerSafe(query.origin ?? query.origins);
    const detailFilter = toLowerSafe(query.detail ?? query.details ?? query.detail_like ?? query.detailContains);
    const detailPathCandidate = Array.isArray(query.detail_path) ? query.detail_path[0] : query.detail_path;
    const detailPath = typeof detailPathCandidate === 'string' ? detailPathCandidate : undefined;
    const detailPathTokens = parseDetailPath(detailPath);
    const limit = parseTelemetryLimit(query.limit);
    const offset = parseTelemetryOffset(query.offset);
    const sinceCandidate = TELEMETRY_DATE_FIELDS.map((key) => query[key]).find((value) => value !== undefined);
    const untilCandidate = TELEMETRY_END_DATE_FIELDS.map((key) => query[key]).find((value) => value !== undefined);
    const since = parseTelemetryDate(Array.isArray(sinceCandidate) ? sinceCandidate[0] : sinceCandidate);
    const until = parseTelemetryDate(Array.isArray(untilCandidate) ? untilCandidate[0] : untilCandidate);
    const sortField = TELEMETRY_SORT_FIELDS.has(String(query.sort ?? '').trim()) ? String(query.sort).trim() : 'receivedAt';
    const sortOrder = TELEMETRY_SORT_ORDERS.has(String(query.order ?? '').toLowerCase())
      ? String(query.order).toLowerCase()
      : 'desc';

    let dataset = telemetryLog.slice().reverse();
    if (componentFilter) {
      dataset = dataset.filter((item) => includesText(item.component, componentFilter));
    }
    if (eventFilter) {
      dataset = dataset.filter((item) => includesText(item.event, eventFilter));
    }
    if (levelFilter) {
      dataset = dataset.filter((item) => toLowerSafe(item.level) === levelFilter);
    }
    if (originFilter) {
      dataset = dataset.filter((item) => toLowerSafe(item.origin) === originFilter);
    }
    if (detailFilter) {
      dataset = dataset.filter((item) => matchesDetailFilter(item.detail ?? null, detailFilter, detailPathTokens));
    }
    if (since || until) {
      dataset = dataset.filter((item) => {
        const timestamp = resolveTimestamp(item);
        if (!timestamp) return !since && !until;
        if (since && timestamp < since) return false;
        if (until && timestamp > until) return false;
        return true;
      });
    }

    dataset.sort((a, b) => {
      if (sortField === 'component' || sortField === 'event') {
        const valueA = (a?.[sortField] ?? '').toLowerCase();
        const valueB = (b?.[sortField] ?? '').toLowerCase();
        return sortOrder === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
      }
      if (sortField === 'level' || sortField === 'origin') {
        const valueA = toLowerSafe(a?.[sortField]) ?? '';
        const valueB = toLowerSafe(b?.[sortField]) ?? '';
        return sortOrder === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
      }
      const timeA = resolveTimestamp(a)?.getTime() ?? 0;
      const timeB = resolveTimestamp(b)?.getTime() ?? 0;
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });

    const paged = dataset.slice(offset, offset + limit);
    res.json({
      items: paged,
      total: dataset.length,
      limit,
      offset,
      sort: sortField,
      order: sortOrder,
    });
  });

  app.get('/health/telemetry', (req, res) => {
    const total = telemetryLog.length;
    const seededEvents = telemetryLog.filter(
      (item) => item?.detail && typeof item.detail === 'object' && item.detail.seeded === true,
    );
    const lastEvent = total > 0 ? telemetryLog[telemetryLog.length - 1] : null;
    const lastSeeded = seededEvents.length > 0 ? seededEvents[seededEvents.length - 1] : null;
    const status = seededEvents.length > 0 ? 'ok' : 'empty';
    res.json({
      status,
      message:
        status === 'ok'
          ? 'telemetry events available'
          : 'no seeded telemetry events recorded',
      events: {
        total,
        seeded: seededEvents.length,
        lastEventAt: lastEvent?.timestamp ?? null,
        lastSeededAt: lastSeeded?.timestamp ?? null,
      },
      fallbackActive:
        String(process.env.PODMAN_HOST_FALLBACK_ACTIVE || 'false').toLowerCase() === 'true',
    });
  });

  app.get('/metrics/summary', (req, res) => {
    const refresh = String(req.query?.refresh ?? '').toLowerCase() === 'true';
    const snapshot = getMetricsSnapshot(refresh);
    if (refresh) {
      logMetricsSnapshot(snapshot, 'refresh');
      broadcastMetrics(snapshot);
    }
    res.json(buildMetricsPayload(snapshot));
  });

  app.get('/metrics/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);
    const snapshot = getMetricsSnapshot(false);
    logMetricsSnapshot(snapshot, 'sse-initial');
    res.write(`data: ${JSON.stringify(buildMetricsPayload(snapshot))}\n\n`);

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
