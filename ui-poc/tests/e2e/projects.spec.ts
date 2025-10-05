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
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { projects: baseProjects } }),
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
