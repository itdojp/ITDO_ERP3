import { test, expect } from '@playwright/test';

const API_MODE = process.env.E2E_EXPECT_API === 'true';

test.describe('Projects PoC', () => {
  test('displays AI insights panel with fallback data', async ({ page }) => {
    await page.goto('/projects');
    const panel = page.getByTestId('project-insights-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('AI ハイライト');
    await expect(panel).toContainText('CPI');
  });

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

  test('filters projects by keyword search', async ({ page }) => {
    const dataset = [
      {
        id: 'PRJ-1000',
        code: 'PRJ-1000',
        name: 'Marketing Revamp',
        clientName: 'Northwind Trading',
        status: 'planned',
        startOn: '2025-03-01',
        endOn: null,
        manager: '田中',
        health: 'green',
        tags: ['marketing'],
      },
      {
        id: 'PRJ-2000',
        code: 'ANL-2000',
        name: 'Analytics Platform',
        clientName: 'Contoso Analytics',
        status: 'active',
        startOn: '2025-01-15',
        endOn: null,
        manager: '佐藤',
        health: 'yellow',
        tags: ['data'],
      },
    ];

    await page.route('**/graphql', async (route) => {
      const payload = JSON.parse(route.request().postData() ?? '{}');
      const { query, variables = {} } = payload;
      if (query?.includes('ProjectsPage')) {
        const keyword = (variables.keyword ?? '').toLowerCase();
        const status = (variables.status ?? 'all').toLowerCase();
        let filtered = dataset;
        if (status !== 'all') {
          filtered = filtered.filter((project) => project.status === status);
        }
        if (keyword) {
          filtered = filtered.filter((project) => {
            const haystack = `${project.name} ${project.code} ${project.clientName ?? ''}`.toLowerCase();
            return haystack.includes(keyword);
          });
        }
        const manager = (variables.manager ?? '').toLowerCase();
        if (manager) {
          filtered = filtered.filter((project) => (project.manager ?? '').toLowerCase().includes(manager));
        }
        const tag = (variables.tag ?? '').toLowerCase();
        if (tag) {
          filtered = filtered.filter((project) => (project.tags ?? []).map((value) => value?.toLowerCase()).includes(tag));
        }
        const health = (variables.health ?? '').toLowerCase();
        if (health) {
          filtered = filtered.filter((project) => project.health === health);
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              projects: {
                items: filtered,
                meta: {
                  total: filtered.length,
                  fetchedAt: new Date().toISOString(),
                  fallback: false,
                  returned: filtered.length,
                },
                pageInfo: {
                  endCursor: filtered.length > 0 ? filtered[filtered.length - 1]?.id ?? null : null,
                  hasNextPage: false,
                },
              },
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/projects');
    await page.evaluate(() => localStorage.removeItem('projects-filters-v1'));
    await page.reload();

    await page.getByTestId('projects-search-input').fill('Analytics');
    await page.getByRole('button', { name: '検索' }).click();
    await expect(page.locator('article')).toHaveCount(1);
    await expect(page.locator('article').first()).toContainText('Analytics Platform');

    await page.getByTestId('projects-filter-manager').fill('佐藤');
    await page.getByTestId('projects-filter-health').selectOption('yellow');
    await page.getByRole('button', { name: '検索' }).click();
    await expect(page.locator('article')).toHaveCount(1);
    await page.getByTestId('projects-filter-tag').fill('data');
    await page.getByRole('button', { name: '検索' }).click();
    await expect(page.locator('article')).toHaveCount(1);

    await page.getByRole('button', { name: 'All' }).click();
    await page.getByTestId('projects-search-input').fill('');
    await page.getByTestId('projects-filter-manager').fill('');
    await page.getByTestId('projects-filter-tag').fill('');
    await page.getByTestId('projects-filter-health').selectOption('');
    await page.getByRole('button', { name: '検索' }).click();
    await expect(page.locator('article')).toHaveCount(dataset.length);
  });

  test('persists filters to query and localStorage', async ({ page }) => {
    const dataset = [
      {
        id: 'PRJ-3000',
        code: 'PRJ-3000',
        name: 'Rev Ops Expansion',
        clientName: 'Northwind',
        status: 'planned',
        startOn: '2025-04-01',
        endOn: null,
        manager: '田中',
        health: 'green',
        tags: ['ops'],
      },
      {
        id: 'PRJ-4000',
        code: 'ANL-4000',
        name: 'Analytics Launcher',
        clientName: 'Contoso',
        status: 'active',
        startOn: '2025-02-12',
        endOn: null,
        manager: '佐藤',
        health: 'yellow',
        tags: ['data'],
      },
    ];

    await page.route('**/graphql', async (route) => {
      const payload = JSON.parse(route.request().postData() ?? '{}');
      const { query, variables = {} } = payload;
      if (query?.includes('ProjectsPage')) {
        const status = (variables.status ?? 'all').toLowerCase();
        const keyword = (variables.keyword ?? '').toLowerCase();
        let filtered = dataset;
        if (status !== 'all') {
          filtered = filtered.filter((project) => project.status === status);
        }
        if (keyword) {
          filtered = filtered.filter((project) => {
            const haystack = `${project.name} ${project.code} ${project.clientName ?? ''}`.toLowerCase();
            return haystack.includes(keyword);
          });
        }
        const manager = (variables.manager ?? '').toLowerCase();
        if (manager) {
          filtered = filtered.filter((project) => (project.manager ?? '').toLowerCase().includes(manager));
        }
        const tag = (variables.tag ?? '').toLowerCase();
        if (tag) {
          filtered = filtered.filter((project) => (project.tags ?? []).map((value) => value?.toLowerCase()).includes(tag));
        }
        const health = (variables.health ?? '').toLowerCase();
        if (health) {
          filtered = filtered.filter((project) => project.health === health);
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              projects: {
                items: filtered,
                meta: {
                  total: filtered.length,
                  fetchedAt: new Date().toISOString(),
                  fallback: false,
                  returned: filtered.length,
                },
                pageInfo: {
                  endCursor: filtered.length > 0 ? filtered[filtered.length - 1]?.id ?? null : null,
                  hasNextPage: false,
                },
              },
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/projects');
    await page.evaluate(() => localStorage.removeItem('projects-filters-v1'));
    await page.reload();

    await page.getByRole('button', { name: 'Active' }).click();
    await page.getByTestId('projects-search-input').fill('Analytics');
    await page.getByTestId('projects-filter-manager').fill('佐藤');
    await page.getByTestId('projects-filter-tag').fill('data');
    await page.getByTestId('projects-filter-health').selectOption('yellow');
    await page.getByRole('button', { name: '検索' }).click();

    await expect(page).toHaveURL(/status=active/);
    await expect(page).toHaveURL(/keyword=Analytics/);
    await expect(page).toHaveURL(/manager=%E4%BD%90%E8%97%A4/);
    await expect(page).toHaveURL(/tag=data/);
    await expect(page).toHaveURL(/health=yellow/);
    await expect(page.locator('article')).toHaveCount(1);
    await expect(page.locator('article').first()).toContainText('Analytics Launcher');

    await page.reload();
    await expect(page.getByTestId('projects-search-input')).toHaveValue('Analytics');
    await expect(page.getByTestId('projects-filter-manager')).toHaveValue('佐藤');
    await expect(page.getByTestId('projects-filter-tag')).toHaveValue('data');
    await expect(page.getByTestId('projects-filter-health')).toHaveValue('yellow');
    await expect(page.locator('article')).toHaveCount(1);

    await page.goto('/projects', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('projects-search-input')).toHaveValue('Analytics');
    await expect(page.getByTestId('projects-filter-manager')).toHaveValue('佐藤');
    await expect(page.getByTestId('projects-filter-tag')).toHaveValue('data');
    await expect(page.getByTestId('projects-filter-health')).toHaveValue('yellow');
    await expect(page.locator('article')).toHaveCount(1);
  });

  test('creates project via GraphQL form with API stubs', async ({ page }) => {
    test.skip(API_MODE, 'GraphQL stub test runs only in mock mode');
    const baseProjects = [
      {
        id: 'PRJ-2000',
        code: 'PRJ-2000',
        name: 'Initial Project',
        clientName: 'Demo',
        status: 'planned',
        startOn: '2025-01-01',
        endOn: null,
        manager: '山田太郎',
        health: 'green',
        tags: ['demo'],
      },
    ];
    let createdProject;

    await page.route('**/graphql', async (route) => {
      const request = route.request();
      const payload = JSON.parse(request.postData() ?? '{}');
      const { query, variables } = payload;

      if (query?.includes('ProjectsPage')) {
        const keyword = (variables?.keyword ?? '').toLowerCase();
        const status = (variables?.status ?? 'all').toLowerCase();
        let responseProjects = [...baseProjects];
        if (createdProject) {
          responseProjects = [createdProject, ...responseProjects];
        }
        if (status !== 'all') {
          responseProjects = responseProjects.filter((project) => project.status === status);
        }
        if (keyword) {
          responseProjects = responseProjects.filter((project) => {
            const haystack = `${project.name} ${project.code} ${project.clientName ?? ''}`.toLowerCase();
            return haystack.includes(keyword);
          });
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              projects: {
                items: responseProjects,
                meta: {
                  total: responseProjects.length,
                  fetchedAt: new Date().toISOString(),
                  fallback: false,
                  returned: responseProjects.length,
                },
                pageInfo: {
                  endCursor: responseProjects.length > 0 ? responseProjects[0]?.id ?? null : null,
                  hasNextPage: false,
                },
              },
            },
          }),
        });
        return;
      }

      if (query?.includes('CreateProject')) {
        createdProject = {
          id: `PRJ-${Date.now()}`,
          code: variables.input.code ?? `PRJ-${Date.now()}`,
          name: variables.input.name,
          clientName: variables.input.clientName ?? null,
          status: variables.input.status ?? 'planned',
          startOn: '2025-02-01',
          endOn: null,
          manager: variables.input.manager ?? null,
          health: variables.input.health ?? 'green',
          tags: [],
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { createProject: { ok: true, project: createdProject } } }),
        });
        return;
      }

      if (query?.includes('TransitionProject') || query?.includes('projectTransition')) {
        createdProject = {
          ...createdProject,
          status: 'active',
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { projectTransition: { ok: true, project: createdProject } } }),
        });
        return;
      }

      await route.continue();
    });

    await page.route('**/api/v1/projects/*/activate', async (route) => {
      if (!createdProject) {
        await route.fulfill({ status: 500 });
        return;
      }
      createdProject = { ...createdProject, status: 'active' };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, project: createdProject }),
      });
    });

    await page.goto('/projects');

    await page.getByLabel('プロジェクト名', { exact: false }).fill('GraphQL Added');
    await page.getByLabel('コード').fill('GQL-ADD');
    await page.getByLabel('クライアント').fill('GraphQL Co.');
    await page.getByRole('button', { name: 'GraphQLで追加' }).click();

    await expect(page.getByText('プロジェクトを追加しました')).toBeVisible();

    // Transition via action button
    await page.locator('article', { hasText: 'GraphQL Added' }).first().locator('button', { hasText: 'Activate' }).click();
    await expect(page.locator('article', { hasText: 'GraphQL Added' }).first()).toContainText('Active');
  });
});
