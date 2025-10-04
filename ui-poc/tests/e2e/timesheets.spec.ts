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
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { timesheets: baseTimesheets } }),
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
  });
});
