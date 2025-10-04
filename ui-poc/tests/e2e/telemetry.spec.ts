import { test, expect } from '@playwright/test';
import type { TelemetryResponse } from '@/features/telemetry/types';

test.describe('Telemetry page (mock fallback)', () => {
  test('shows empty state when telemetry API is unavailable', async ({ page }) => {
    await page.goto('/telemetry');
    await expect(page.getByRole('heading', { name: 'Telemetry Monitor' })).toBeVisible();
    await expect(page.getByText('Telemetry イベントはまだありません。')).toBeVisible();
    await expect(page.getByTestId('telemetry-total')).toHaveText('0');
  });

  test('auto refresh pulls latest events when API recovers', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/v1/telemetry/ui*', async (route) => {
      callCount += 1;
      const payload =
        callCount === 1
          ? { items: [], total: 0 }
          : {
              items: [
                {
                  component: 'auto-refresh',
                  event: 'auto-refresh-event',
                  level: 'info',
                  detail: { source: 'poll' },
                  receivedAt: new Date().toISOString(),
                },
              ],
              total: 1,
            };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
    });

    await page.goto('/telemetry?pollMs=500');
    await page.waitForTimeout(1200);
    await expect(page.getByTestId('telemetry-total')).toHaveText('1', { timeout: 5000 });
    await expect(page.getByTestId('telemetry-table')).toContainText('auto-refresh-event');
  });

  test('filters telemetry events by component, event and level', async ({ page }) => {
    await page.route('**/api/v1/telemetry/ui*', async (route) => {
      const url = new URL(route.request().url());
      const level = url.searchParams.get('level');
      const component = url.searchParams.get('component');
      const detail = url.searchParams.get('detail');
      const detailPath = url.searchParams.get('detail_path');
      const body = {
        items: [
          {
            component: component ?? 'ui',
            event: level === 'warn' ? 'fallback' : 'load',
            level: level ?? 'info',
            origin: 'client',
            receivedAt: new Date().toISOString(),
            detail: {
              component,
              marker: detail ?? 'baseline',
              path: detailPath ?? 'n/a',
            },
          },
        ],
        total: 1,
      } satisfies TelemetryResponse;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    await page.goto('/telemetry?pollMs=1000');
    await page.getByTestId('telemetry-filter-component').fill('ui');
    await page.getByTestId('telemetry-filter-level').selectOption('warn');
    await page.getByTestId('telemetry-filter-detail').fill('telemetry');
    await page.getByTestId('telemetry-filter-detail-path').fill('$.marker');
    await page.getByTestId('telemetry-filter-sort').selectOption('component');
    await page.getByTestId('telemetry-filter-order').selectOption('asc');
    await page.getByTestId('telemetry-filter-apply').click();

    await expect(page.getByRole('row', { name: /fallback/ })).toContainText('warn');
    await expect(page.getByRole('row', { name: /fallback/ })).toContainText('telemetry');
    await expect(page.getByRole('row', { name: /fallback/ })).toContainText('$.marker');
    await expect(page).toHaveURL(/component=ui/);
    await expect(page).toHaveURL(/level=warn/);
    await expect(page).toHaveURL(/detail=telemetry/);
    await expect(page).toHaveURL(/detail_path=%24\.marker/);
    await expect(page).toHaveURL(/sort=component/);
    await expect(page).toHaveURL(/order=asc/);
  });

  test('filters telemetry events by JSONPath expressions targeting arrays', async ({ page }) => {
    await page.route('**/api/v1/telemetry/ui*', async (route) => {
      const url = new URL(route.request().url());
      const detail = url.searchParams.get('detail');
      const detailPath = url.searchParams.get('detail_path');
      const body = {
        items: [
          {
            component: 'ui',
            event: 'jsonpath-match',
            level: 'info',
            origin: 'client',
            receivedAt: new Date().toISOString(),
            detail: {
              items: [
                { code: 'alpha', status: 'ok' },
                { code: detail ?? 'bravo', status: 'selected' },
              ],
              filterPath: detailPath,
            },
          },
        ],
        total: 1,
      } satisfies TelemetryResponse;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    await page.goto('/telemetry?pollMs=1000');
    await page.getByTestId('telemetry-filter-detail').fill('BRAVO');
    await page.getByTestId('telemetry-filter-detail-path').fill('items[1].code');
    await page.getByTestId('telemetry-filter-apply').click();

    await expect(page.getByTestId('telemetry-table')).toContainText('jsonpath-match');
    await expect(page.getByTestId('telemetry-table')).toContainText('items[1].code');
    await expect(page).toHaveURL(/detail=BRAVO/);
    await expect(page).toHaveURL(/detail_path=items%5B1%5D.code/);
  });
});
