import { test, expect } from '@playwright/test';

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
});
