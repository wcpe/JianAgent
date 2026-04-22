import { test, expect } from './fixtures.js';

type RouteCheck = {
  readonly name: string;
  readonly path: string;
  readonly heading?: string;
};

const ROUTES: readonly RouteCheck[] = [
  { name: 'dashboard', path: '/dashboard', heading: 'Dashboard' },
  { name: 'servers', path: '/servers', heading: '服务器管理' },
  { name: 'terminals', path: '/terminals', heading: '终端' },
  { name: 'bots', path: '/bots', heading: '机器人控制台' },
  { name: 'quick-tests', path: '/quick-tests', heading: '测试控制台' },
  { name: 'sessions', path: '/sessions', heading: '压测会话' },
  { name: 'session-templates', path: '/session-templates', heading: '会话模板' },
  { name: 'monitoring', path: '/monitoring', heading: '服务器监控' },
  { name: 'population', path: '/population', heading: '在线人数' },
  { name: 'diagnostics', path: '/diagnostics', heading: '诊断' },
  { name: 'logs', path: '/logs', heading: '日志' },
  { name: 'alerts', path: '/alerts', heading: '告警' },
  { name: 'audit', path: '/audit', heading: '审计' },
  { name: 'workers', path: '/workers' },
  { name: 'jvm-observability', path: '/jvm-observability', heading: 'JVM Observability' },
];

test.describe('Full Route Clickthrough', () => {
  test('covers routes and clicks visible buttons', async ({ authedPage: page }) => {
    test.setTimeout(180000);
    await page.addInitScript(() => {
      localStorage.setItem('token', 'route-test-token');
    });

    for (const route of ROUTES) {
      await page.goto('/login');
      await page.evaluate(() => localStorage.setItem('token', 'route-test-token'));
      await page.goto(route.path);
      await expect(page).toHaveURL(new RegExp(route.path.replace('/', '\\/')));

      if (route.heading) {
        await expect(page.locator('h1')).toContainText(route.heading, { timeout: 10000 });
      }

      const buttons = page.locator('button:visible');
      const count = await buttons.count();
      const maxClicks = Math.min(count, 6);
      for (let i = 0; i < maxClicks; i++) {
        const btn = buttons.nth(i);
        const text = (await btn.textContent().catch(() => ''))?.trim() ?? '';
        if (text.includes('退出登录') || text.includes('登录')) continue;
        const disabled = await btn.isDisabled().catch(() => true);
        if (disabled) continue;
        await btn.click({ timeout: 3000 }).catch(() => {});
      }

      await page.screenshot({
        path: `test-results/manual/routes/${route.name}.png`,
        fullPage: true,
      });
    }
  });
});
