import request from 'supertest';
import { createTestServer } from '../test-utils/createTestServer.js';

describe('REST API idempotency', () => {
const { app } = createTestServer({ enableRest: true });

  test('POST /api/v1/projects honours Idempotency-Key header', async () => {
    const idempotencyKey = 'rest-project-key';

    const first = await request(app)
      .post('/api/v1/projects')
      .set('Idempotency-Key', idempotencyKey)
      .send({ name: 'REST Project' })
      .expect(201);

    expect(first.body.ok).toBe(true);
    const projectId = first.body.item.id;

    const second = await request(app)
      .post('/api/v1/projects')
      .set('Idempotency-Key', idempotencyKey)
      .send({ name: 'REST Project' })
      .expect(200);

    expect(second.body.ok).toBe(true);
    expect(second.body.idempotent).toBe(true);
    expect(second.body.item.id).toBe(projectId);

    await request(app)
      .post('/api/v1/projects')
      .send({ id: projectId, name: 'Duplicate Without Key' })
      .expect(409);
  });

  test('POST /api/v1/timesheets honours Idempotency-Key header', async () => {
    const idempotencyKey = 'rest-timesheet-key';

    const first = await request(app)
      .post('/api/v1/timesheets')
      .set('Idempotency-Key', idempotencyKey)
      .send({ userName: 'Rest Tester', projectCode: 'REST', hours: 4 })
      .expect(201);

    expect(first.body.ok).toBe(true);
    const timesheetId = first.body.item.id;

    const second = await request(app)
      .post('/api/v1/timesheets')
      .set('Idempotency-Key', idempotencyKey)
      .send({ userName: 'Rest Tester', projectCode: 'REST', hours: 4 })
      .expect(200);

    expect(second.body.ok).toBe(true);
    expect(second.body.idempotent).toBe(true);
    expect(second.body.item.id).toBe(timesheetId);

    await request(app)
      .post('/api/v1/timesheets')
      .send({ id: timesheetId, userName: 'Rest Tester', projectCode: 'REST' })
      .expect(409);
  });
});

describe('Telemetry API', () => {
  test('stores telemetry events and exposes them via GET', async () => {
    const server = createTestServer({ enableRest: true });
    const { app: telemetryApp } = server;

    await request(telemetryApp)
      .post('/api/v1/telemetry/ui')
      .set('Content-Type', 'application/json')
      .send({ component: 'jest', event: 'first', level: 'info', detail: { test: true } })
      .expect(204);

    const response = await request(telemetryApp).get('/api/v1/telemetry/ui').query({ limit: 200 }).expect(200);
    expect(response.body.total).toBe(1);
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items[0].event).toBe('first');
    expect(response.body.items[0].detail).toEqual({ test: true });
  });

  test('keeps only the latest 200 telemetry events', async () => {
    const { app: telemetryApp, telemetryLog } = createTestServer({ enableRest: true });

    for (let index = 0; index < 205; index += 1) {
      await request(telemetryApp)
        .post('/api/v1/telemetry/ui')
        .set('Content-Type', 'application/json')
        .send({ component: 'jest', event: `evt-${index}` })
        .expect(204);
    }

    const response = await request(telemetryApp)
      .get('/api/v1/telemetry/ui')
      .query({ limit: 200 })
      .expect(200);
    expect(response.body.total).toBe(200);
    expect(response.body.limit).toBe(200);
    expect(response.body.items[0].event).toBe('evt-204');
    expect(response.body.items.length).toBeLessThanOrEqual(200);

    const tail = await request(telemetryApp)
      .get('/api/v1/telemetry/ui')
      .query({ limit: 1, offset: 199 })
      .expect(200);
    expect(tail.body.items).toHaveLength(1);
    expect(tail.body.items[0].event).toBe('evt-5');
  });

  test('supports filtering by component, event and level', async () => {
    const { app: telemetryApp } = createTestServer({ enableRest: true });

    const samples = [
      { component: 'ui', event: 'load', level: 'info' },
      { component: 'ui', event: 'fallback', level: 'warn' },
      { component: 'server', event: 'load', level: 'info' },
    ];

    for (const sample of samples) {
      await request(telemetryApp)
        .post('/api/v1/telemetry/ui')
        .set('Content-Type', 'application/json')
        .send(sample)
        .expect(204);
    }

    const res = await request(telemetryApp)
      .get('/api/v1/telemetry/ui')
      .query({ component: 'ui', event: 'fall', level: 'warn' })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].event).toBe('fallback');
  });

  test('filters telemetry events by detail substring', async () => {
    const { app: telemetryApp } = createTestServer({ enableRest: true });

    const entries = [
      { component: 'ui', event: 'fallback', level: 'warn', detail: { marker: 'telemetry-mock', code: 'T-001' } },
      { component: 'ui', event: 'load', level: 'info', detail: { marker: 'baseline' } },
    ];

    for (const entry of entries) {
      await request(telemetryApp)
        .post('/api/v1/telemetry/ui')
        .set('Content-Type', 'application/json')
        .send(entry)
        .expect(204);
    }

    const res = await request(telemetryApp)
      .get('/api/v1/telemetry/ui')
      .query({ detail: 'telemetry-mock', detail_path: '$.marker' })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.items[0].detail.marker).toBe('telemetry-mock');
    expect(res.body.items[0].component).toBe('ui');
  });

  test('filters telemetry events using JSONPath arrays and wildcards', async () => {
    const { app: telemetryApp } = createTestServer({ enableRest: true });

    const event = {
      component: 'ui',
      event: 'jsonpath',
      level: 'info',
      detail: {
        nested: [
          { code: 'alpha', message: 'ok' },
          { code: 'beta', message: 'target' },
        ],
        checks: {
          first: { status: 'ok' },
          second: { status: 'pending' },
        },
      },
    };

    await request(telemetryApp)
      .post('/api/v1/telemetry/ui')
      .set('Content-Type', 'application/json')
      .send(event)
      .expect(204);

    const arrayRes = await request(telemetryApp)
      .get('/api/v1/telemetry/ui')
      .query({ detail: 'beta', detail_path: 'nested[1].code' })
      .expect(200);
    expect(arrayRes.body.total).toBe(1);
    expect(arrayRes.body.items[0].event).toBe('jsonpath');

    const wildcardRes = await request(telemetryApp)
      .get('/api/v1/telemetry/ui')
      .query({ detail: 'pending', detail_path: 'checks[*].status' })
      .expect(200);
    expect(wildcardRes.body.total).toBe(1);
    expect(wildcardRes.body.items[0].detail.checks.second.status).toBe('pending');
  });

  test('supports quoted keys and invalid JSONPath fallbacks', async () => {
    const { app: telemetryApp } = createTestServer({ enableRest: true });

    await request(telemetryApp)
      .post('/api/v1/telemetry/ui')
      .set('Content-Type', 'application/json')
      .send({
        component: 'gateway',
        event: 'trace-recorded',
        level: 'info',
        detail: {
          trace: {
            'id.v1': 'trace-alpha',
            segments: [{ status: 'ok' }, { status: 'degraded' }],
          },
        },
      })
      .expect(204);

    const quotedKey = await request(telemetryApp)
      .get('/api/v1/telemetry/ui')
      .query({ detail: 'trace-alpha', detail_path: "trace['id.v1']" })
      .expect(200);
    expect(quotedKey.body.total).toBe(1);

    const arrayWildcard = await request(telemetryApp)
      .get('/api/v1/telemetry/ui')
      .query({ detail: 'degraded', detail_path: 'trace.segments[*].status' })
      .expect(200);
    expect(arrayWildcard.body.total).toBe(1);

    const invalidPath = await request(telemetryApp)
      .get('/api/v1/telemetry/ui')
      .query({ detail: 'trace-alpha', detail_path: 'trace[unknown].value' })
      .expect(200);
    expect(invalidPath.body.total).toBe(0);
  });

  test('filters telemetry events by date range', async () => {
    const server = createTestServer({ enableRest: true });
    const { app: telemetryApp } = server;

    const baseTime = new Date('2025-10-04T12:00:00.000Z');
    const payloads = [
      { component: 'ui', event: 'early', receivedAt: new Date(baseTime.getTime() - 3600_000).toISOString() },
      { component: 'ui', event: 'window', receivedAt: new Date(baseTime.getTime() + 5_000).toISOString() },
      { component: 'ui', event: 'late', receivedAt: new Date(baseTime.getTime() + 3600_000).toISOString() },
    ];

    for (const payload of payloads) {
      await request(telemetryApp)
        .post('/api/v1/telemetry/ui')
        .set('Content-Type', 'application/json')
        .send(payload)
        .expect(204);
    }
    // overwrite timestamps to deterministic values
    server.telemetryLog[0].receivedAt = payloads[0].receivedAt;
    server.telemetryLog[1].receivedAt = payloads[1].receivedAt;
    server.telemetryLog[2].receivedAt = payloads[2].receivedAt;

    const since = new Date(baseTime.getTime() - 1000).toISOString();
    const until = new Date(baseTime.getTime() + 10_000).toISOString();

    const res = await request(telemetryApp)
      .get('/api/v1/telemetry/ui')
      .query({ since, until, order: 'asc' })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].event).toBe('window');
    expect(res.body.order).toBe('asc');
  });

  test('sorts telemetry events by component ascending', async () => {
    const server = createTestServer({ enableRest: true });
    const { app: telemetryApp } = server;

    const entries = [
      { component: 'zeta', event: 'A' },
      { component: 'alpha', event: 'B' },
      { component: 'beta', event: 'C' },
    ];

    for (const entry of entries) {
      await request(telemetryApp)
        .post('/api/v1/telemetry/ui')
        .set('Content-Type', 'application/json')
        .send(entry)
        .expect(204);
    }

    const res = await request(telemetryApp)
      .get('/api/v1/telemetry/ui')
      .query({ sort: 'component', order: 'asc' })
      .expect(200);

    expect(res.body.items[0].component).toBe('alpha');
    expect(res.body.items[res.body.items.length - 1].component).toBe('zeta');
    expect(res.body.sort).toBe('component');
    expect(res.body.order).toBe('asc');
  });

  test('applies pagination via limit and offset', async () => {
    const { app: telemetryApp } = createTestServer({ enableRest: true });

    for (let index = 0; index < 10; index += 1) {
      await request(telemetryApp)
        .post('/api/v1/telemetry/ui')
        .set('Content-Type', 'application/json')
        .send({ component: 'jest', event: `evt-${index}` })
        .expect(204);
    }

    const firstPage = await request(telemetryApp)
      .get('/api/v1/telemetry/ui')
      .query({ limit: 3 })
      .expect(200);
    expect(firstPage.body.items).toHaveLength(3);
    expect(firstPage.body.items[0].event).toBe('evt-9');

    const secondPage = await request(telemetryApp)
      .get('/api/v1/telemetry/ui')
      .query({ limit: 3, offset: 3 })
      .expect(200);
    expect(secondPage.body.items).toHaveLength(3);
    expect(secondPage.body.items[0].event).toBe('evt-6');
    expect(secondPage.body.offset).toBe(3);
  });
});
