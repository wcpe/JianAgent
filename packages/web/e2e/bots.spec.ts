import { test, expect } from './fixtures.js';

test.describe('Bot Workspace', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.route('**/api/bots?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
          meta: { total: 0, page: 1, limit: 200 },
        }),
      });
    });

    await page.route('**/api/bots/stats**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { total: 0, online: 0, offline: 0, error: 0 },
        }),
      });
    });

    await page.route('**/api/bots/saved-configs**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });
  });

  test('loads bot console page', async ({ authedPage: page }) => {
    await page.goto('/bots');
    await expect(page.locator('h1')).toHaveText('机器人控制台', { timeout: 10000 });
  });

  test('has toolbar buttons', async ({ authedPage: page }) => {
    await page.goto('/bots');
    await expect(page.locator('h1')).toHaveText('机器人控制台', { timeout: 10000 });

    await expect(page.getByRole('button', { name: '脚本编辑器' })).toBeVisible();
    await expect(page.getByRole('button', { name: '全部停止' })).toBeVisible();
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible();
  });

  test('card and table view toggle', async ({ authedPage: page }) => {
    await page.goto('/bots');
    await expect(page.locator('h1')).toHaveText('机器人控制台', { timeout: 10000 });

    const cardBtn = page.getByRole('button', { name: '卡片' });
    const tableBtn = page.getByRole('button', { name: '表格' });
    await expect(cardBtn).toBeVisible();
    await expect(tableBtn).toBeVisible();

    // Wait for data to load (loading text disappears)
    await expect(page.getByText('加载中...')).not.toBeVisible({ timeout: 10000 });

    // Switch to table view
    await tableBtn.click();

    // If bots exist, table headers appear; otherwise empty state shows
    const hasTable = await page.locator('th').filter({ hasText: '名称' }).isVisible().catch(() => false);
    const hasEmpty = await page.getByText('暂无机器人').isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBeTruthy();

    // Switch back to card
    await cardBtn.click();
  });

  test('server filter dropdown works', async ({ authedPage: page }) => {
    await page.goto('/bots');
    await expect(page.locator('h1')).toHaveText('机器人控制台', { timeout: 10000 });

    const select = page.locator('select').first();
    await expect(select).toBeVisible();
    // Should have at least "全部服务器" option
    await expect(select.locator('option').first()).toHaveText('全部服务器');
  });

  test('search input exists', async ({ authedPage: page }) => {
    await page.goto('/bots');
    await expect(page.locator('h1')).toHaveText('机器人控制台', { timeout: 10000 });
    await expect(page.getByPlaceholder('搜索机器人...')).toBeVisible();
  });

  test('config panel visible', async ({ authedPage: page }) => {
    await page.goto('/bots');
    await expect(page.locator('h1')).toHaveText('机器人控制台', { timeout: 10000 });

    // Config section header
    await expect(page.getByText(/已保存的配置/)).toBeVisible();
    await expect(page.getByRole('button', { name: '导入配置' })).toBeVisible();
  });

  test('chat panel visible', async ({ authedPage: page }) => {
    await page.goto('/bots');
    await expect(page.locator('h1')).toHaveText('机器人控制台', { timeout: 10000 });

    // Chat panel header
    await expect(page.getByText(/游戏聊天/)).toBeVisible();
  });

  test('script editor opens', async ({ authedPage: page }) => {
    await page.goto('/bots');
    await expect(page.locator('h1')).toHaveText('机器人控制台', { timeout: 10000 });

    await page.getByRole('button', { name: '脚本编辑器' }).click();
    await expect(page).toHaveURL(/scripts/);
    await expect(page.getByText('脚本编辑器')).toBeVisible();

    // Tabs
    await expect(page.getByText('可视化编辑')).toBeVisible();
    await expect(page.getByText('文本编辑')).toBeVisible();
    await expect(page.getByRole('button', { name: '模板' })).toBeVisible();

    // Action panel
    await expect(page.getByText('动作面板')).toBeVisible();
  });

  test('stats bar shows counts', async ({ authedPage: page }) => {
    await page.goto('/bots');
    await expect(page.locator('h1')).toHaveText('机器人控制台', { timeout: 10000 });

    // Wait for data to load
    await page.waitForTimeout(2000);

    await expect(page.getByText('总计')).toBeVisible();
    await expect(page.getByText('在线', { exact: true })).toBeVisible();
    await expect(page.getByText('离线', { exact: true })).toBeVisible();
    await expect(page.getByText('异常', { exact: true })).toBeVisible();
  });
});
