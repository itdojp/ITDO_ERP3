import { test, expect } from '@playwright/test';

const REQUIRE_API = process.env.E2E_EXPECT_API === 'true';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? `http://localhost:${process.env.PM_PORT ?? '3001'}`;

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

  test('metrics stream pushes realtime updates', async ({ page, request }) => {
    await page.goto('/');
    const streamPayload = await page.evaluate(async (base: string) => {
      return await new Promise<string>((resolve, reject) => {
        try {
          const url = new URL('/metrics/stream', base).toString();
          const source = new EventSource(url);
          const timer = setTimeout(() => {
            source.close();
            reject(new Error('SSE timeout'));
          }, 8000);
          source.onmessage = (event) => {
            clearTimeout(timer);
            source.close();
            resolve(event.data);
          };
          source.onerror = (event) => {
            clearTimeout(timer);
            source.close();
            reject(new Error(`SSE error: ${JSON.stringify(event)}`));
          };
        } catch (error) {
          reject(error);
        }
      });
    }, API_BASE);

    const parsed = JSON.parse(streamPayload) as Record<string, unknown>;
    expect(parsed).toHaveProperty('projects');
    expect(parsed).toHaveProperty('cachedAt');

    const refresh = await request.get(`${API_BASE}/metrics/summary?refresh=true`);
    expect(refresh.ok()).toBeTruthy();
  });

  test('telemetry page displays latest events', async ({ page, request }) => {
    const eventName = `e2e-telemetry-${Date.now()}`;
    const response = await request.post(`${API_BASE}/api/v1/telemetry/ui`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        component: 'e2e-test',
        event: eventName,
        level: 'info',
        detail: { scenario: 'playwright-api-live' },
      },
    });
    expect(response.ok()).toBeTruthy();

    await page.goto('/telemetry');
    const telemetryTable = page.getByTestId('telemetry-table');
    await expect(telemetryTable).toContainText('e2e-test');
    await expect(telemetryTable).toContainText(eventName);
    await expect(telemetryTable).toContainText('info');
  });
});
