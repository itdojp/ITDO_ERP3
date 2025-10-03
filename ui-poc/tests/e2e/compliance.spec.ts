import { test, expect } from '@playwright/test';

test.describe('Compliance PoC', () => {
  test('performs mock search and shows detail panel', async ({ page }) => {
    await page.goto('/compliance');

    await expect(page.getByRole('heading', { name: 'Compliance PoC' })).toBeVisible();
    await expect(page.locator('table thead')).toContainText('請求書番号');

    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible();

    const SUBJECT_COLUMN_INDEX = 3;
    const subjectText = (await firstRow.locator('td').nth(SUBJECT_COLUMN_INDEX).innerText()).trim();

    await firstRow.click();
    await expect(page.getByRole('heading', { name: subjectText })).toBeVisible();

    await page.getByPlaceholder('請求書番号 / 取引先 / タグ等').fill('Acme');
    await page.getByRole('button', { name: '検索' }).click();
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  });
});
