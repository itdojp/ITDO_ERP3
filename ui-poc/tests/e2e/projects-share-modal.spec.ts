import { test, expect } from '@playwright/test';

const clipboardInitScript = () => {
  window.__copiedTexts = [];
  const stub = {
    writeText: (text: string) => {
      window.__copiedTexts.push(text);
      return Promise.resolve();
    },
  };
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    get: () => stub,
  });
};

declare global {
  interface Window {
    __copiedTexts: string[];
  }
}

test.describe('Projects share modal', () => {
  test('switches formats and copies rendered content', async ({ page }) => {
    await page.addInitScript(clipboardInitScript);
    await page.goto('/projects');

    await page.getByRole('button', { name: 'Slack テンプレをコピー' }).click();
    await expect(page.getByRole('button', { name: 'Slack テンプレをコピーしました' })).toBeVisible();

    await page.getByRole('button', { name: '編集してコピー' }).click();
    await expect(page.getByRole('heading', { name: 'Slack 共有テンプレートを編集' })).toBeVisible();

    const formatSelect = page.getByLabel('出力形式');
    await formatSelect.selectOption('json');
    await expect(page.getByText('プレビュー（JSON）')).toBeVisible();
    const jsonPreview = await page.locator('pre').textContent();
    expect(jsonPreview?.trim().startsWith('{')).toBe(true);

    await page.getByRole('button', { name: 'この内容でコピー' }).click();
    await expect(page.getByRole('button', { name: 'コピーしました' })).toBeVisible();

    const copiedTexts = await page.evaluate(() => window.__copiedTexts.slice());
    expect(copiedTexts.length).toBeGreaterThanOrEqual(2);
    expect(copiedTexts[copiedTexts.length - 1]).toContain('"message"');

    await formatSelect.selectOption('markdown');
    await expect(page.getByText('プレビュー（Markdown）')).toBeVisible();
    const markdownPreview = await page.locator('pre').textContent();
    expect(markdownPreview?.includes('**Projects')).toBe(true);

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Slack 共有テンプレートを編集' })).not.toBeVisible();
  });
});
