import { test, expect } from '@playwright/test';

const API_MODE = process.env.E2E_EXPECT_API === 'true';

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
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { projects: filtered } }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/projects');

    await expect(page.locator('article')).toHaveCount(dataset.length);
    await page.getByTestId('projects-search-input').fill('Analytics');
    await page.getByRole('button', { name: '検索' }).click();
    await expect(page.locator('article')).toHaveCount(1);
    await expect(page.locator('article').first()).toContainText('Analytics Platform');

    await page.getByRole('button', { name: 'クリア' }).click();
    await expect(page.locator('article')).toHaveCount(dataset.length);
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
          body: JSON.stringify({ data: { projects: responseProjects } }),
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
    const newCard = page.locator('article', { hasText: 'GraphQL Added' }).first();
    await newCard.locator('button', { hasText: 'Activate' }).click();
    await expect(page.locator('article', { hasText: 'GraphQL Added' }).first()).toContainText('Active');
  });
});
