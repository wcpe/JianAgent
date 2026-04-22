import { test, expect } from './fixtures.js';

test.describe('Logs Aggregate Search', () => {
  test('shows validation error when keyword is empty', async ({ authedPage: page }) => {
    await page.goto('/logs');
    await expect(page.locator('h1')).toHaveText('日志', { timeout: 10000 });

    await page.getByRole('button', { name: '开始聚合查询' }).click();
    await expect(page.getByText('请输入搜索关键字')).toBeVisible();
  });

  test('submits keyword and filter inputs to aggregate query', async ({ authedPage: page }) => {
    let capturedUrl: URL | null = null;

    await page.route('**/api/logs/aggregate?**', async (route) => {
      capturedUrl = new URL(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            serverId: 'srv-alpha',
            file: 'latest.log',
            line: 42,
            content: '[INFO] plugin check: KEYWORD_MATCH',
          },
        ]),
      });
    });

    await page.goto('/logs');
    await expect(page.locator('h1')).toHaveText('日志', { timeout: 10000 });

    await page.getByLabel('聚合关键字搜索').fill('KEYWORD_MATCH');
    await page.getByLabel('服务器筛选（可选，逗号分隔 serverId）').fill('srv-alpha, srv-beta');
    await page.getByLabel('区分大小写').check();
    await page.locator('#search-field').selectOption('both');

    await page.getByRole('button', { name: '开始聚合查询' }).click();

    await expect.poll(() => capturedUrl?.searchParams.get('q')).toBe('KEYWORD_MATCH');
    await expect.poll(() => capturedUrl?.searchParams.get('serverIds')).toBe('srv-alpha,srv-beta');
    await expect.poll(() => capturedUrl?.searchParams.get('caseSensitive')).toBe('true');
    await expect.poll(() => capturedUrl?.searchParams.get('fields')).toBe('content,file');
    await expect.poll(() => capturedUrl?.searchParams.get('maxPerServer')).toBe('100');
    await expect.poll(() => capturedUrl?.searchParams.get('maxTotal')).toBe('500');

    await expect(page.getByRole('cell', { name: 'srv-alpha' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'latest.log' })).toBeVisible();
    await expect(page.getByText('KEYWORD_MATCH')).toBeVisible();
  });
});