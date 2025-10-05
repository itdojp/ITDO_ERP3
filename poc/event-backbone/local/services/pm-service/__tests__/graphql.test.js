import request from 'supertest';
import { createTestServer } from '../test-utils/createTestServer.js';
import { invoiceSeed } from '../sample-data.js';

const { app, projects, timesheets } = createTestServer();

const graphql = (query, variables) =>
  request(app)
    .post('/graphql')
    .set('Content-Type', 'application/json')
    .send({ query, variables });

describe('GraphQL schema', () => {
  test('queries projects via GraphQL', async () => {
    const response = await graphql(
      `
        query Projects($status: String) {
          projects(status: $status) {
            id
            name
            status
          }
        }
      `,
      { status: 'all' },
    ).expect(200);

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.projects).toHaveLength(projects.length);
    const ids = response.body.data.projects.map((p) => p.id);
    expect(new Set(ids)).toEqual(new Set(projects.map((p) => p.id)));
  });

  test('filters projects by keyword', async () => {
    const target = projects.find((project) => project.clientName) ?? projects[0];
    expect(target).toBeTruthy();
    const keywordSource = target.clientName || target.name;
    const keyword = keywordSource.slice(0, 4);

    const response = await graphql(
      `
        query Projects($keyword: String) {
          projects(keyword: $keyword) {
            id
            clientName
          }
        }
      `,
      { keyword },
    ).expect(200);

    expect(response.body.errors).toBeUndefined();
    const returned = response.body.data.projects;
    expect(returned.length).toBeGreaterThan(0);
    returned.forEach((project) => {
      expect((project.clientName || '').toLowerCase()).toContain(keyword.toLowerCase());
    });
  });

  test('creates and transitions project via GraphQL', async () => {
    const createRes = await graphql(
      `
        mutation CreateProject($input: CreateProjectInput!) {
          createProject(input: $input) {
            ok
            project { id name status }
          }
        }
      `,
      { input: { name: 'GraphQL Demo', status: 'planned' } },
    ).expect(200);

    expect(createRes.body.errors).toBeUndefined();
    const projectId = createRes.body.data.createProject.project.id;
    expect(projectId).toBeTruthy();

    const transitionRes = await graphql(
      `
        mutation Transition($input: ProjectTransitionInput!) {
          projectTransition(input: $input) {
            ok
            project { id status }
          }
        }
      `,
      { input: { projectId, action: 'activate' } },
    ).expect(200);

    expect(transitionRes.body.errors).toBeUndefined();
    expect(transitionRes.body.data.projectTransition.project.status).toBe('active');
  });

  test('creates and approves timesheet via GraphQL', async () => {
    const createRes = await graphql(
      `
        mutation CreateTimesheet($input: CreateTimesheetInput!) {
          createTimesheet(input: $input) {
            ok
            timesheet { id approvalStatus }
          }
        }
      `,
      {
        input: {
          userName: 'GraphQL Tester',
          projectCode: timesheets[0].projectCode,
          hours: 4,
          autoSubmit: true,
        },
      },
    ).expect(200);

    expect(createRes.body.errors).toBeUndefined();
    const timesheetId = createRes.body.data.createTimesheet.timesheet.id;
    expect(timesheetId).toBeTruthy();
    expect(createRes.body.data.createTimesheet.timesheet.approvalStatus).toBe('submitted');

    const approveRes = await graphql(
      `
        mutation Approve($input: TimesheetActionInput!) {
          timesheetAction(input: $input) {
            ok
            timesheet { id approvalStatus }
          }
        }
      `,
      { input: { timesheetId, action: 'approve' } },
    ).expect(200);

    expect(approveRes.body.errors).toBeUndefined();
    expect(approveRes.body.data.timesheetAction.timesheet.approvalStatus).toBe('approved');
  });

  test('filters timesheets by keyword', async () => {
    const sample = timesheets[0];
    const keyword = sample.projectCode.slice(0, 3);

    const response = await graphql(
      `
        query Timesheets($keyword: String, $status: String) {
          timesheets(keyword: $keyword, status: $status) {
            id
            projectCode
            userName
          }
        }
      `,
      { keyword, status: 'all' },
    ).expect(200);

    expect(response.body.errors).toBeUndefined();
    const rows = response.body.data.timesheets;
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      const haystack = `${row.projectCode} ${row.userName}`.toLowerCase();
      expect(haystack).toContain(keyword.toLowerCase());
    });
  });

  test('returns compliance invoices metadata', async () => {
    const res = await graphql(
      `
        query Compliance($page: Int) {
          complianceInvoices(filter: { page: $page, pageSize: 5 }) {
            meta { total page pageSize }
            items {
              id
              invoiceNumber
              attachments { id downloadUrl }
            }
          }
        }
      `,
      { page: 1 },
    ).expect(200);

    expect(res.body.errors).toBeUndefined();
    const { items, meta } = res.body.data.complianceInvoices;
    expect(meta.page).toBe(1);
    expect(meta.pageSize).toBe(5);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
    const expectedFirstAttachmentUrls = invoiceSeed[0].attachments.map((attachment) => attachment.downloadUrl);
    const actualFirstAttachmentUrls = items[0].attachments.map((attachment) => attachment.downloadUrl);
    expect(actualFirstAttachmentUrls).toEqual(expectedFirstAttachmentUrls);
  });

  test('compliance invoices attach download urls when MinIO is enabled', async () => {
    const mkDownloadUrl = (id) => `https://minio.local/object/${id}`;
    const { app: minioApp } = createTestServer({
      useMinio: true,
      attachDownloadUrls: async (items) =>
        items.map((item) => ({
          ...item,
          attachments: (item.attachments || []).map((attachment) => ({
            ...attachment,
            downloadUrl: mkDownloadUrl(attachment.id),
          })),
        })),
    });

    const response = await request(minioApp)
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .send({
        query: `
          query ComplianceMinio {
            complianceInvoices(filter: { page: 1, pageSize: 1 }) {
              items {
                id
                attachments { id downloadUrl }
              }
              meta { fallback }
            }
          }
        `,
      })
      .expect(200);

    expect(response.body.errors).toBeUndefined();
    const { items, meta } = response.body.data.complianceInvoices;
    expect(meta.fallback).toBe(false);
    expect(items).not.toHaveLength(0);
    for (const item of items) {
      expect(item.attachments.length).toBeGreaterThan(0);
      item.attachments.forEach((attachment) => {
        expect(attachment.downloadUrl).toBe(mkDownloadUrl(attachment.id));
      });
    }
  });

  test('createProject is idempotent when idempotencyKey is reused', async () => {
    const idempotencyKey = 'project-key-123';
    const mutation = `
      mutation CreateProject($input: CreateProjectInput!) {
        createProject(input: $input) {
          ok
          message
          project { id code name }
        }
      }
    `;

    const first = await graphql(mutation, { input: { name: 'Idempotent Project', idempotencyKey } }).expect(200);
    expect(first.body.errors).toBeUndefined();
    expect(first.body.data.createProject.ok).toBe(true);
    const projectId = first.body.data.createProject.project.id;

    const second = await graphql(mutation, { input: { name: 'Idempotent Project', idempotencyKey } }).expect(200);
    expect(second.body.errors).toBeUndefined();
    expect(second.body.data.createProject.ok).toBe(true);
    expect(second.body.data.createProject.project.id).toBe(projectId);
    expect(second.body.data.createProject.message).toContain('idempotent');
  });

  test('createTimesheet is idempotent when idempotencyKey is reused', async () => {
    const idempotencyKey = 'timesheet-key-456';
    const mutation = `
      mutation CreateTimesheet($input: CreateTimesheetInput!) {
        createTimesheet(input: $input) {
          ok
          message
          timesheet { id approvalStatus }
        }
      }
    `;

    const input = {
      userName: 'Idempotent User',
      projectCode: 'PRJ-IDEMP',
      hours: 3,
      autoSubmit: true,
      idempotencyKey,
    };

    const first = await graphql(mutation, { input }).expect(200);
    expect(first.body.errors).toBeUndefined();
    expect(first.body.data.createTimesheet.ok).toBe(true);
    const timesheetId = first.body.data.createTimesheet.timesheet.id;

    const second = await graphql(mutation, { input }).expect(200);
    expect(second.body.errors).toBeUndefined();
    expect(second.body.data.createTimesheet.ok).toBe(true);
    expect(second.body.data.createTimesheet.timesheet.id).toBe(timesheetId);
    expect(second.body.data.createTimesheet.message).toContain('idempotent');
  });
});
