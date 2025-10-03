import { test, expect } from '@playwright/test';

test.describe('Projects PoC', () => {
  test('shows project cards and filters by status', async ({ page }) => {
    await page.goto('/projects');

    await expect(page.getByRole('heading', { name: 'Projects PoC' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();

    const firstCard = page.locator('article').first();
    await expect(firstCard).toBeVisible();

    await page.getByRole('button', { name: 'Planned' }).click();
    await expect(page.locator('article').first()).toContainText('Planned');

    await page.getByRole('button', { name: 'Active' }).click();
    await expect(page.locator('article').first()).toContainText('Active');
  });
});
