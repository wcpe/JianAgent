import { test, expect } from './fixtures.js';

test.describe('Dashboard', () => {
  test('loads and shows summary cards', async ({ authedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toHaveText('Dashboard', { timeout: 10000 });

    // Summary cards exist
    await expect(page.getByText('服务器总数')).toBeVisible();
    await expect(page.getByText('运行中')).toBeVisible();
    await expect(page.getByText('异常', { exact: true })).toBeVisible();
    await expect(page.getByText('Bot 总数')).toBeVisible();
  });

  test('shows server list section', async ({ authedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toHaveText('Dashboard', { timeout: 10000 });
    await expect(page.locator('h2').filter({ hasText: '服务器列表' })).toBeVisible();
  });

  test('shows alert summary and session overview', async ({ authedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toHaveText('Dashboard', { timeout: 10000 });
    await expect(page.locator('h2').filter({ hasText: '告警摘要' })).toBeVisible();
    await expect(page.locator('h2').filter({ hasText: '会话概览' })).toBeVisible();
  });
});
