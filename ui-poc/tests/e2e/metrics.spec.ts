import { test, expect } from '@playwright/test';

test.describe('Metrics SSE', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const registry: any[] = [];
      class FakeEventSource {
        url: string;
        readyState: number;
        listeners: Record<string, ((event: MessageEvent) => void)[]>;
        constructor(url: string) {
          this.url = url;
          this.readyState = 0;
          this.listeners = {};
          registry.push(this);
        }
        addEventListener(type: string, handler: (event: MessageEvent) => void) {
          this.listeners[type] = this.listeners[type] ?? [];
          this.listeners[type].push(handler);
        }
        removeEventListener(type: string, handler: (event: MessageEvent) => void) {
          this.listeners[type] = (this.listeners[type] ?? []).filter((fn) => fn !== handler);
        }
        dispatch(type: string, event: MessageEvent) {
          (this.listeners[type] ?? []).forEach((handler) => handler(event));
        }
        close() {
          this.readyState = 2;
        }
      }
      // @ts-ignore
      window.__eventSourceRegistry = registry;
      // @ts-ignore
      window.__dispatchSseMessage = (payload: unknown) => {
        registry.forEach((source) => {
          source.dispatch('message', { data: JSON.stringify(payload) } as MessageEvent);
        });
      };
      // @ts-ignore
      window.EventSource = FakeEventSource;
    });
  });

  test('updates metrics panel when SSE message arrives', async ({ page }) => {
    const initialMetrics = {
      projects: { planned: 2, active: 3 },
      timesheets: { submitted: 4, approved: 1 },
      invoices: { pending: 5, matched: 2 },
      events: 10,
      cachedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
      cacheTtlMs: 5000,
      stale: false,
    };

    await page.route('http://localhost:3001/metrics/summary*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(initialMetrics),
      });
    });

    await page.goto('/');
    await expect(page.getByTestId('metrics-panel')).toBeVisible();
    await expect(page.getByTestId('metrics-events')).toContainText('10');
    await expect(page.getByTestId('metrics-history')).toContainText('10');

    const updatedMetrics = {
      ...initialMetrics,
      events: 42,
      cachedAt: new Date('2024-01-01T00:00:10Z').toISOString(),
    };

    await page.evaluate((payload) => {
      // @ts-ignore
      window.__dispatchSseMessage(payload);
    }, updatedMetrics);

    await expect(page.getByTestId('metrics-events')).toContainText('42');
    await expect(page.getByTestId('metrics-history')).toContainText('42');
    await expect(page.getByTestId('metrics-history')).toContainText('10');
  });
});
