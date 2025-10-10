import express from 'express';
import { graphqlHTTP } from 'express-graphql';
import { nanoid } from 'nanoid';
import { createGraphQLSchema } from '../graphql-schema.js';
import { projectSeed, timesheetSeed, invoiceSeed, telemetrySeed, filterInvoices } from '../sample-data.js';

const PROJECT_ACTIONS = new Set(['activate', 'hold', 'resume', 'close']);
const TIMESHEET_ACTIONS = new Set(['submit', 'approve', 'reject', 'resubmit']);

const nextProjectStatusMap = {
  planned: { activate: 'active', close: 'closed' },
  active: { hold: 'onhold', close: 'closed' },
  onhold: { resume: 'active', close: 'closed' },
  closed: {},
};

const nextTimesheetStatusMap = {
  draft: { submit: 'submitted' },
  submitted: { approve: 'approved', reject: 'rejected' },
  rejected: { resubmit: 'submitted' },
  approved: {},
};

const cloneDeep = (value) => (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

const parseTelemetryLimit = (value, { defaultValue = 50, max = 200 } = {}) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return Math.min(parsed, max);
};

const parseTelemetryOffset = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

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

export function createTestServer(options = {}) {
  const {
    useMinio = false,
    attachDownloadUrls = async (items) => items,
    enableRest = false,
    seedTelemetry = false,
  } = options;
  const projects = cloneDeep(projectSeed);
  const timesheets = cloneDeep(timesheetSeed);
  const invoices = cloneDeep(invoiceSeed);
  const eventLog = [];
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
    return enriched;
  };

  if (seedTelemetry && Array.isArray(telemetrySeed) && telemetrySeed.length > 0) {
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
          ip: 'seed::test',
          timestamp,
        },
      );
    });
  }

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
    if (!metricsSnapshot || force || Date.now() - metricsSnapshot.computedAt > 5000) {
      metricsSnapshot = computeMetricsSnapshot();
    }
    return metricsSnapshot;
  };

  const buildMetricsPayload = (snapshot) => ({
    ...snapshot.data,
    cachedAt: new Date(snapshot.computedAt).toISOString(),
    cacheTtlMs: 5000,
    stale: Date.now() - snapshot.computedAt > 5000,
  });

  const logMetricsSnapshot = () => {};
  const broadcastMetrics = () => {};
  const persistSnapshot = () => Promise.resolve();

  const publishTimesheetApproved = async ({ timesheetId, employeeId, projectId, hours, rateType, note }) => {
    const eventId = nanoid();
    const record = {
      eventId,
      occurredAt: new Date().toISOString(),
      eventType: 'pm.timesheet.approved',
      tenantId: 'test',
      timesheetId,
      employeeId,
      projectId,
      hours,
      rateType,
      note,
    };
    eventLog.push(record);
    return { eventId, shard: 0 };
  };

  const buildCompliance = async (params, attachContext) => {
    const result = buildComplianceInvoices(params, invoices);
    if (useMinio && attachContext && typeof attachContext.attach === 'function' && Array.isArray(result.items) && result.items.length > 0) {
      result.items = await attachContext.attach(result.items);
    }
    return result;
  };

  const projectIdempotencyKeys = new Map();
  const timesheetIdempotencyKeys = new Map();

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
    attachDownloadUrls,
    filterInvoices,
    buildComplianceInvoicesResponse: buildCompliance,
    projectActions: PROJECT_ACTIONS,
    timesheetActions: TIMESHEET_ACTIONS,
    nextProjectStatus: (current, action) => nextProjectStatusMap[current]?.[action] || null,
    nextTimesheetStatus: (current, action) => nextTimesheetStatusMap[current]?.[action] || null,
    useMinio,
    projectIdempotencyKeys,
    timesheetIdempotencyKeys,
  });

  const app = express();
  app.use('/graphql', graphqlHTTP({ schema, graphiql: false }));

  if (enableRest) {
    app.use(express.json());

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
      const sinceCandidate = query.since ?? query.from ?? query.start ?? query.after;
      const untilCandidate = query.until ?? query.to ?? query.end ?? query.before;
      const since = parseTelemetryDate(Array.isArray(sinceCandidate) ? sinceCandidate[0] : sinceCandidate);
      const until = parseTelemetryDate(Array.isArray(untilCandidate) ? untilCandidate[0] : untilCandidate);
      const sortField = typeof query.sort === 'string' ? query.sort : 'receivedAt';
      const sortOrder = typeof query.order === 'string' && query.order.toLowerCase() === 'asc' ? 'asc' : 'desc';

      let dataset = telemetryLog.slice().reverse();
      if (componentFilter) dataset = dataset.filter((item) => includesText(item.component, componentFilter));
      if (eventFilter) dataset = dataset.filter((item) => includesText(item.event, eventFilter));
      if (levelFilter) dataset = dataset.filter((item) => toLowerSafe(item.level) === levelFilter);
      if (originFilter) dataset = dataset.filter((item) => toLowerSafe(item.origin) === originFilter);
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

      const sliced = dataset.slice(offset, offset + limit);
      res.json({ items: sliced, total: dataset.length, limit, offset, order: sortOrder, sort: sortField });
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
        message: status === 'ok' ? 'telemetry events available' : 'no seeded telemetry events recorded',
        events: {
          total,
          seeded: seededEvents.length,
          lastEventAt: lastEvent?.timestamp ?? null,
          lastSeededAt: lastSeeded?.timestamp ?? null,
        },
        fallbackActive: Boolean(options.fallbackActive),
      });
    });

    app.post('/api/v1/projects', (req, res) => {
      const { code, name, clientName, status = 'planned', startOn, endOn, manager, health = 'green', tags = [] } = req.body || {};
      if (!name) {
        return res.status(400).json({ error: 'name required' });
      }
      const id = req.body?.id || `PRJ-${nanoid(6)}`;
      const idempotencyKey = (req.header('Idempotency-Key') || req.body?.idempotencyKey || '').trim();
      if (idempotencyKey) {
        const existingId = projectIdempotencyKeys.get(idempotencyKey);
        if (existingId) {
          const existing = projects.find((item) => item.id === existingId || item.code === existingId);
          if (existing) {
            return res.json({ ok: true, item: existing, idempotent: true });
          }
        }
      }
      if (projects.some((item) => item.id === id || (code && item.code === code))) {
        return res.status(409).json({ error: 'duplicate_project' });
      }
      const now = new Date().toISOString();
      const created = {
        id,
        code: code || id,
        name,
        clientName: clientName || 'Internal',
        status,
        startOn: startOn || now.slice(0, 10),
        endOn: endOn || null,
        manager: manager || null,
        health,
        tags,
        createdAt: now,
        updatedAt: now,
      };
      projects.push(created);
      if (idempotencyKey) {
        projectIdempotencyKeys.set(idempotencyKey, created.id);
      }
      res.status(201).json({ ok: true, item: created });
    });

    app.post('/api/v1/timesheets', (req, res) => {
      const { userName, projectId, projectCode, projectName, workDate, hours = 8, note, rateType = 'standard' } = req.body || {};
      if (!userName || !(projectId || projectCode)) {
        return res.status(400).json({ error: 'userName and projectId/projectCode are required' });
      }
      const id = req.body?.id || `TS-${nanoid(6)}`;
      const idempotencyKey = (req.header('Idempotency-Key') || req.body?.idempotencyKey || '').trim();
      if (idempotencyKey) {
        const existingId = timesheetIdempotencyKeys.get(idempotencyKey);
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
      const now = new Date().toISOString();
      const created = {
        id,
        userName,
        employeeId: req.body?.employeeId || `EMP-${nanoid(4)}`,
        projectId: projectId || projectCode,
        projectCode: projectCode || projectId || id,
        projectName: projectName || 'Untitled Project',
        taskName: req.body?.taskName || null,
        workDate: workDate || now.slice(0, 10),
        hours,
        approvalStatus: 'draft',
        note: note || null,
        rateType,
        createdAt: now,
        updatedAt: now,
      };
      timesheets.push(created);
      if (idempotencyKey) {
        timesheetIdempotencyKeys.set(idempotencyKey, created.id);
      }
      res.status(201).json({ ok: true, item: created });
    });
  }

  return {
    app,
    projects,
    timesheets,
    invoices,
    eventLog,
    telemetryLog,
    projectIdempotencyKeys,
    timesheetIdempotencyKeys,
  };
}

function countByKey(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] ?? 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function buildComplianceInvoices(params = {}, invoices) {
  const filters = {
    keyword: params.keyword,
    status: params.status,
  };
  const filtered = filterInvoices(filters, invoices);
  return {
    items: filtered.slice(0, params.pageSize ?? 25),
    meta: {
      total: filtered.length,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
      totalPages: 1,
      sortBy: params.sortBy ?? 'issueDate',
      sortDir: params.sortDir ?? 'desc',
      fetchedAt: new Date().toISOString(),
      fallback: false,
    },
  };
}
