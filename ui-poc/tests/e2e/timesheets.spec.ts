import { test, expect } from '@playwright/test';

const API_MODE = process.env.E2E_EXPECT_API === 'true';

test.describe('Timesheets PoC', () => {
  test('displays timesheet table and actions', async ({ page }) => {
    await page.goto('/timesheets');

    await expect(page.getByRole('heading', { name: 'Timesheets PoC' })).toBeVisible();
    await expect(page.locator('table thead')).toContainText('状態');

    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();

    const actionsCell = rows.first().locator('td').last();
    await expect(actionsCell.getByRole('button').first()).toBeVisible();

    await expect(page.getByTestId('timesheets-summary-count')).toContainText('表示件数');
    await expect(page.getByTestId('timesheets-summary-filters')).toContainText('フィルタ');
  });

  test('filters timesheets by keyword search', async ({ page }) => {
    const dataset = [
      {
        id: 'TS-1000',
        userName: 'Alice',
        projectCode: 'PRJ-MKT',
        projectName: 'Marketing Revamp',
        taskName: null,
        workDate: '2025-03-05',
        hours: 7.5,
        approvalStatus: 'submitted',
        note: 'Initial submission',
        submittedAt: '2025-03-05T09:00:00Z',
      },
      {
        id: 'TS-2000',
        userName: 'Bob',
        projectCode: 'PRJ-ANL',
        projectName: 'Analytics Platform',
        taskName: null,
        workDate: '2025-03-06',
        hours: 8,
        approvalStatus: 'submitted',
        note: 'Data modelling',
        submittedAt: '2025-03-06T10:00:00Z',
      },
      {
        id: 'TS-3000',
        userName: 'Carol',
        projectCode: 'PRJ-OPS',
        projectName: 'Operations Cleanup',
        taskName: null,
        workDate: '2025-03-07',
        hours: 6,
        approvalStatus: 'approved',
        note: null,
        submittedAt: '2025-03-07T10:30:00Z',
      },
    ];

    await page.route('**/graphql', async (route) => {
      const payload = JSON.parse(route.request().postData() ?? '{}');
      const { query, variables = {} } = payload;
      if (query?.includes('TimesheetsPage')) {
        const keyword = (variables.keyword ?? '').toLowerCase();
        const status = (variables.status ?? 'all').toLowerCase();
        let filtered = dataset;
        if (status !== 'all') {
          filtered = filtered.filter((entry) => entry.approvalStatus === status);
        }
        if (keyword) {
          filtered = filtered.filter((entry) => {
            const haystack = `${entry.projectName} ${entry.projectCode} ${entry.userName} ${entry.note ?? ''}`.toLowerCase();
            return haystack.includes(keyword);
          });
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { timesheets: filtered } }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/timesheets');

    await expect(page.locator('table tbody tr')).toHaveCount(2);
    await page.getByTestId('timesheets-search-input').fill('Analytics');
    await page.getByRole('button', { name: '検索' }).click();
    await expect(page.locator('table tbody tr')).toHaveCount(1);
    await expect(page.locator('table tbody tr').first()).toContainText('Analytics Platform');
    await expect(page.getByTestId('timesheets-summary-filters')).toContainText('"Analytics"');

    await page.getByRole('button', { name: 'クリア' }).click();
    await expect(page.locator('table tbody tr')).toHaveCount(2);
    await expect(page.getByTestId('timesheets-summary-filters')).toContainText('指定なし');
  });

  test('adds and approves timesheet via GraphQL form with API stubs', async ({ page }) => {
    test.skip(API_MODE, 'GraphQL stub test runs only in mock mode');
    const baseTimesheets = [
      {
        id: 'TS-2000',
        userName: 'Mock User',
        projectCode: 'PRJ-2000',
        projectName: 'Mock Project',
        taskName: 'Task',
        workDate: '2025-01-10',
        hours: 8,
        approvalStatus: 'submitted',
        note: null,
        submittedAt: '2025-01-10T09:00:00Z',
      },
    ];
    let createdTimesheet;

    await page.route('**/graphql', async (route) => {
      const payload = JSON.parse(route.request().postData() ?? '{}');
      const { query, variables } = payload;

      if (query?.includes('TimesheetsPage')) {
        const status = (variables?.status ?? 'all').toLowerCase();
        const keyword = (variables?.keyword ?? '').toLowerCase();
        let responseEntries = [...baseTimesheets];
        if (createdTimesheet) {
          responseEntries = [createdTimesheet, ...responseEntries];
        }
        if (status !== 'all') {
          responseEntries = responseEntries.filter((entry) => entry.approvalStatus === status);
        }
        if (keyword) {
          responseEntries = responseEntries.filter((entry) => {
            const haystack = `${entry.projectName} ${entry.projectCode} ${entry.userName} ${entry.note ?? ''}`.toLowerCase();
            return haystack.includes(keyword);
          });
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { timesheets: responseEntries } }),
        });
        return;
      }

      if (query?.includes('CreateTimesheet')) {
        createdTimesheet = {
          id: `TS-${Date.now()}`,
          userName: variables.input.userName,
          projectCode: variables.input.projectCode,
          projectName: 'GraphQL Project',
          taskName: null,
          workDate: variables.input.workDate ?? '2025-02-01',
          hours: variables.input.hours ?? 8,
          approvalStatus: variables.input.autoSubmit ? 'submitted' : 'draft',
          note: variables.input.note ?? null,
          submittedAt: variables.input.autoSubmit ? new Date().toISOString() : null,
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { createTimesheet: { ok: true, timesheet: createdTimesheet } } }),
        });
        return;
      }

      if (query?.includes('TimesheetAction')) {
        createdTimesheet = {
          ...createdTimesheet,
          approvalStatus: 'approved',
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { timesheetAction: { ok: true, timesheet: createdTimesheet } } }),
        });
        return;
      }

      await route.continue();
    });

    await page.goto('/timesheets');

    await page.getByLabel('メンバー', { exact: false }).fill('GraphQL Worker');
    await page.getByLabel('プロジェクトコード', { exact: false }).fill('PRJ-GQL');
    await page.getByLabel('工数', { exact: false }).fill('6');
    await page.getByRole('button', { name: 'GraphQLで追加' }).click();

    await expect(page.getByText('タイムシートを追加しました')).toBeVisible();

    const newRow = page.locator('table tbody tr', { hasText: 'GraphQL Worker' }).first();
    await newRow.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('GraphQL Worker / PRJ-GQL: Approve 完了')).toBeVisible();
    await page.getByRole('button', { name: 'All' }).click();
    await expect(page.locator('table tbody tr', { hasText: 'GraphQL Worker' }).first()).toContainText('Approved');
    await expect(page.getByTestId('timesheets-summary-filters')).toContainText('すべて');
  });
});
