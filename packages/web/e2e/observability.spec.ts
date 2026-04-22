import { test, expect } from './fixtures.js';

test.describe('Observability', () => {
  test('loads monitoring and jvm observability with mocked data', async ({ authedPage: page }) => {
    await page.route('**/api/servers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'srv-1',
            name: 'Alpha',
            serverType: 'managed',
            runtimeStatus: 'running',
            currentPlayers: 12,
            maxPlayers: 100,
            host: '127.0.0.1',
            port: 25565,
            motd: 'alpha',
            lastStartedAt: null,
            pid: null,
            processUptimeMs: null,
          },
        ]),
      });
    });

    await page.route('**/api/metrics/history?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'metric-1',
              timestamp: '2026-04-14T10:00:00.000Z',
              serverId: 'srv-1',
              tps: 19.8,
              mspt: 33,
              onlinePlayers: 12,
              cpuUsage: 35,
              memoryUsageMb: 512,
              maxMemoryMb: 1024,
              entityCount: 280,
              loadedChunks: 96,
              worldCount: 2,
              maxPlayers: 100,
              pluginCount: 18,
            },
          ],
        }),
      });
    });

    await page.route('**/api/metrics/worlds?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route('**/api/metrics/overview?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            state: 'healthy',
            activeRuleCount: 2,
            activeJmxScheduleCount: 1,
            alertSummary: { totalActive: 0, criticalCount: 0, warningCount: 0, infoCount: 0 },
            signals: [
              {
                source: 'server',
                severity: 'info',
                metric: 'TPS',
                value: 19.8,
                message: '服务器指标稳定',
              },
            ],
          },
        }),
      });
    });

    await page.route('**/api/metrics/jmx/latest?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: null }),
      });
    });

    await page.route('**/api/metrics/jmx/history-aggregated?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route('**/api/metrics/jmx/schedules', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route('**/api/java-helper/jfr/tasks?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.goto('/monitoring');
    await expect(page.locator('h1')).toHaveText('服务器监控', { timeout: 10000 });
    await expect(page.getByText('监控联动摘要')).toBeVisible();
    await expect(page.getByText('当前运行平稳')).toBeVisible();

    await page.goto('/jvm-observability');
    await expect(page.locator('h1')).toHaveText('JVM Observability', { timeout: 10000 });
    await expect(page.getByText('监控联动摘要')).toBeVisible();
    await expect(page.getByText('最新 JMX 快照')).toBeVisible();
  });
});
