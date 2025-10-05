import { test, expect } from '@playwright/test';

const REQUIRE_API = process.env.E2E_EXPECT_API === 'true';

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

  test('supports sorting and paging controls', async ({ page }) => {
    await page.goto('/compliance');

    const meta = page.getByTestId('compliance-meta');
    await expect(meta).toContainText('ヒット件数');

    await page.getByLabel('並び順 (項目)').selectOption('amount');
    await expect(page.locator('table tbody tr').first().locator('td').nth(3)).toContainText(/Laptop refresh program|Laptop/i);

    await page.getByLabel('並び順 (方向)').selectOption('asc');
    await expect(page.locator('table tbody tr').first().locator('td').nth(3)).toContainText(/電力使用料|電力|Laptop refresh program/i);

    await page.getByLabel('1ページ表示件数').selectOption('25');
    const pager = page.getByTestId('compliance-pager');
    await expect(pager).toContainText('1 - ');
    await expect(page.getByRole('button', { name: '次へ' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '前へ' })).toBeDisabled();
  });

  test.skip(REQUIRE_API, 'ライブAPI利用時はモックフォールバックが発生しない');

  test('shows live retry guidance when backend is unavailable', async ({ page }) => {
    await page.route('**/graphql', async (route) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ errors: [{ message: 'down' }] }) });
    });
    await page.route('**/api/v1/compliance/invoices**', async (route) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'unavailable' }) });
    });
    await page.goto('/compliance');
    await page.getByRole('button', { name: '検索' }).click();

    const errorBanner = page.getByText('APIの取得に失敗したため、モックデータを表示しています。', { exact: false });
    await expect(errorBanner).toBeVisible();

    const retryButton = page.getByTestId('compliance-retry-live');
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toBeEnabled();

    await retryButton.click();
    await expect(retryButton).toBeEnabled();
  });
});
