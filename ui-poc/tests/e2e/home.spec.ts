import { test, expect } from '@playwright/test';

test.describe('Home Navigation', () => {
  test('displays overview and navigates to sections', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'UI PoC 概要' })).toBeVisible();
    await expect(page.getByText('ITDO ERP3 UI PoC')).toBeVisible();

    await page.getByRole('link', { name: 'Timesheets' }).click();
    await expect(page).toHaveURL(/\/timesheets$/);
  });
});
