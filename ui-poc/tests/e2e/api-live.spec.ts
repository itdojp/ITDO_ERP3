import { test, expect } from '@playwright/test';

const REQUIRE_API = process.env.E2E_EXPECT_API === 'true';

test.describe('API Live Integration', () => {
  test.skip(!REQUIRE_API, 'Set E2E_EXPECT_API=true to run API live checks.');

  test('timesheets/projects/compliance show API live badge', async ({ page }) => {
    await page.goto('/timesheets');
    await expect(page.getByText('API live')).toBeVisible();

    await page.goto('/projects');
    await expect(page.getByText('API live')).toBeVisible();

    await page.goto('/compliance');
    await expect(page.getByText('API live')).toBeVisible();
  });

  test('compliance download provides signed url', async ({ page, request }) => {
    await page.goto('/compliance');
    await expect(page.getByText('API live')).toBeVisible();

    await page.locator('table tbody tr').first().click();
    const downloadButton = page.getByRole('button', { name: 'ダウンロード' }).first();
    await expect(downloadButton).toBeEnabled();
    await expect(downloadButton).toHaveAttribute('data-download-url', /http:\/\//);

    const apiResponse = await request.get('http://localhost:3001/api/v1/compliance/invoices');
    expect(apiResponse.ok()).toBeTruthy();
    const payload = await apiResponse.json();
    expect(payload.items?.[0]?.attachments?.[0]?.downloadUrl).toMatch(/^http:\/\/localhost:\d+\//);

    await downloadButton.click();
  });
});
