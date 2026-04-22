import { test, expect } from './fixtures.js';

test.describe('Sidebar Navigation', () => {
  const NAV_ITEMS = [
    { label: 'Dashboard', path: '/dashboard', heading: 'Dashboard' },
    { label: '服务器工作台', path: '/servers', heading: '服务器管理' },
    { label: '终端', path: '/terminals', heading: '终端' },
    { label: '机器人工作台', path: '/bots', heading: '机器人控制台' },
    { label: '测试控制台', path: '/quick-tests', heading: '测试控制台' },
    { label: '压测会话', path: '/sessions', heading: '压测会话' },
    { label: '会话模板', path: '/session-templates', heading: '会话模板' },
    { label: '服务器监控', path: '/monitoring', heading: '服务器监控' },
    { label: '在线人数', path: '/population', heading: '在线人数' },
    { label: '诊断', path: '/diagnostics', heading: '诊断' },
    { label: '日志', path: '/logs', heading: '日志' },
    { label: '告警', path: '/alerts', heading: '告警' },
    { label: '审计', path: '/audit', heading: '审计' },
  ];

  for (const item of NAV_ITEMS) {
    test(`navigates to ${item.label}`, async ({ authedPage: page }) => {
      await page.goto('/dashboard');
      await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

      // Click the nav item
      await page.getByRole('link', { name: item.label }).click();
      await expect(page).toHaveURL(new RegExp(item.path));
    });
  }

  test('sidebar collapse toggle', async ({ authedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // JianAgent brand visible by default
    await expect(page.getByText('JianAgent')).toBeVisible();

    // Click collapse button
    await page.getByTitle('收起侧边栏').click();

    // Sidebar should be collapsed (brand hidden)
    await expect(page.getByText('JianAgent')).not.toBeVisible();

    // Click expand button
    await page.getByTitle('展开侧边栏').click();
    await expect(page.getByText('JianAgent')).toBeVisible();
  });
});

test.describe('TopStatusBar', () => {
  test('shows WS status and indicators', async ({ authedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // WS status indicator should be present
    const wsIndicator = page.getByText(/WS (已连接|已断开|重连中)/);
    await expect(wsIndicator).toBeVisible({ timeout: 10000 });

    // Server count
    await expect(page.getByText(/服务器:/)).toBeVisible();

    // Worker count
    await expect(page.getByText(/Worker:/)).toBeVisible();
  });

  test('search palette opens with Ctrl+K', async ({ authedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // Open command palette
    await page.keyboard.press('Control+k');
    const searchInput = page.getByPlaceholder(/搜索/);
    await expect(searchInput).toBeVisible({ timeout: 3000 });

    // Escape closes it
    await page.keyboard.press('Escape');
    await expect(searchInput).not.toBeVisible();
  });
});
