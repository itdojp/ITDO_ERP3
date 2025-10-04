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
});
