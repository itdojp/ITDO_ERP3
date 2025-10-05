import { test, expect } from '@playwright/test';

const REQUIRE_API = process.env.E2E_EXPECT_API === 'true';
const PM_PORT = process.env.PM_PORT ?? '3001';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? `http://localhost:${PM_PORT}`;
const MINIO_REQUIRED = (process.env.E2E_REQUIRE_MINIO ?? 'false').toLowerCase() === 'true';

test.describe('API Live Integration', () => {
  test.skip(!REQUIRE_API, 'Set E2E_EXPECT_API=true to run API live checks.');

  test('timesheets/projects/compliance show API live badge', async ({ page }) => {
    await page.goto('/timesheets');
    await expect(page.getByText('API live')).toBeVisible();

    await page.goto('/projects');
    await expect(page.getByText('API live')).toBeVisible();

    await page.goto('/compliance');
    const liveBadge = page.getByText('API live');
    await expect(liveBadge).toBeVisible();
  });

  test('compliance download provides signed url', async ({ page, request }) => {
    await page.goto('/compliance');
    const liveBadge = page.getByText('API live');
    await expect(liveBadge).toBeVisible();

    await page.locator('table tbody tr').first().click();
    const downloadButton = page.getByRole('button', { name: 'ダウンロード' }).first();
    await expect(downloadButton).toBeEnabled();
    await expect(downloadButton).toHaveAttribute('data-download-url', /https?:\/\//);

    const apiResponse = await request.get(`${API_BASE}/api/v1/compliance/invoices`);
    expect(apiResponse.ok()).toBeTruthy();
    const payload = await apiResponse.json();
    const firstDownload = payload.items?.[0]?.attachments?.[0]?.downloadUrl as string | undefined;
    expect(firstDownload).toBeTruthy();
    const urlPattern = MINIO_REQUIRED ? /^https?:\/\/[^\s]+\/compliance\// : /^https?:\/\//;
    expect(firstDownload).toMatch(urlPattern);

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

  test('GraphQL metrics summary matches SSE payload', async ({ page, request }) => {
    const graphqlResponse = await request.post(`${API_BASE}/graphql`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        query: `#graphql
          query MetricsSummary($refresh: Boolean) {
            metricsSummary(refresh: $refresh) {
              events
              projects
              timesheets
              invoices
              cachedAt
              stale
            }
          }
        `,
        variables: { refresh: true },
      },
    });
    expect(graphqlResponse.ok()).toBeTruthy();
    const payload = await graphqlResponse.json();
    expect(payload.errors).toBeFalsy();
    const summary = payload.data?.metricsSummary;
    expect(summary).toBeTruthy();
    expect(typeof summary.events).toBe('number');
    expect(summary.cachedAt).toBeTruthy();

    await page.goto('/');
    const streamPayload = await page.evaluate(async (base: string) => {
      return await new Promise<Record<string, unknown>>((resolve, reject) => {
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
            try {
              resolve(JSON.parse(event.data));
            } catch (error) {
              reject(error);
            }
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

    expect(streamPayload).toHaveProperty('events');
    expect(streamPayload).toHaveProperty('projects');
    expect(streamPayload).toHaveProperty('cachedAt');
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
