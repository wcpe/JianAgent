/**
 * P1-5 运行态指标持续刷新与过期提示 — 浏览器端到端测试
 *
 * 覆盖场景：
 * 1. 运行中服务器卡片显示完整指标面板（在线玩家、TPS、内存、CPU）
 * 2. 指标面板显示正确的数据值
 * 3. 指标每 5 秒自动刷新
 * 4. 指标超过 15 秒未更新时显示"数据可能过期"提示
 * 5. 混合场景下仅运行中服务器显示指标面板，已停止的不显示
 *
 * 注意：
 *   - route mock 使用 glob pattern（`**`），避免正则匹配的陷阱
 *   - metrics/latest 使用 apiFetch，mock 需返回 { success, data } 格式
 *   - metrics/overview 直接返回 DTO，无需 success/data 包装
 *   - metrics fetch 在组件渲染后（useEffect）才触发，需等待首次 fetch 完成
 */
import { test, expect } from '../../e2e/fixtures.js';

// ──────────────────────────────────────────────
// Helper: 创建模拟指标快照（包裹在 apiFetch 格式中）
// ──────────────────────────────────────────────
function createMetricSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    data: {
      id: `ms-${Date.now()}`,
      timestamp: new Date().toISOString(),
      serverId: 'srv-running',
      tps: 19.8,
      mspt: 18.5,
      onlinePlayers: 5,
      maxPlayers: 20,
      cpuUsage: 23.5,
      memoryUsageMb: 256,
      maxMemoryMb: 1024,
      entityCount: 450,
      loadedChunks: 128,
      worldCount: 4,
      onlineBots: 2,
      maxMemory: 1024,
      usedMemory: 256,
      freeMemory: 768,
      ...overrides,
    },
  };
}

// ──────────────────────────────────────────────
// Helper: 创建模拟 overview 响应
// overview 端点直接返回 MonitoringOverviewDto，不包 success/data
// ──────────────────────────────────────────────
function createOverview(state = 'healthy') {
  return { state, status: state, uptime: 3600 };
}

// ──────────────────────────────────────────────
// 公共 payload
// ──────────────────────────────────────────────
const singleServerPayload = {
  items: [{
    summary: {
      id: 'srv-running', kind: 'SERVER', name: 'End-to-End Server',
      status: 'running', statusDetail: null,
      hostType: 'local', host: '127.0.0.1', port: 25565,
      tags: ['e2e', 'prod'],
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
    },
    serverType: 'managed', group: 'core',
    description: '端到端测试运行中服务器',
    status: { state: 'RUNNING', health: 'healthy', detail: null, uptimeSec: 3600, onlinePlayers: 5, maxPlayers: 20, version: '1.21.1' },
    capabilities: {
      terminal: { enabled: true, maxSessions: 3 },
      files: { enabled: true, rootPath: '/srv' },
      plugins: { enabled: true, pluginCount: 4 },
      logs: { enabled: true, collectionCount: 2 },
      audit: { enabled: true },
      jvm: { enabled: true, helperAttached: false, jfrSupported: false },
      minecraft: { enabled: true, isMinecraft: true, serverVersion: '1.21.1', probeConnected: false },
      monitoring: { enabled: true, probeActive: true, jmxEnabled: false, alertRuleCount: 1 },
      validation: { enabled: true },
    },
    availableActions: [
      { key: 'stop', label: '停止', kind: 'primary', enabled: true },
      { key: 'restart', label: '重启', kind: 'primary', enabled: true },
      { key: 'terminal', label: '终端', kind: 'navigation', enabled: true },
      { key: 'plugin', label: '插件管理', kind: 'navigation', enabled: true },
      { key: 'log', label: '日志查看', kind: 'navigation', enabled: true },
    ],
    latestValidationSummary: { state: 'PASSED', verdict: 'passed', finishedAt: '2026-04-20T00:10:00.000Z', runId: 'lvr_001' },
  }],
  summary: { total: 1, byKind: { SERVER: 1 }, byStatus: { running: 1 }, byServerType: { managed: 1 } },
  page: 1, limit: 24, total: 1,
};

const mixedPayload = {
  items: [
    {
      summary: { id: 'srv-running', kind: 'SERVER', name: 'Running Server', status: 'running', statusDetail: null, hostType: 'local', host: '127.0.0.1', port: 25565, tags: ['prod'], createdAt: '2026-04-20T00:00:00.000Z', updatedAt: '2026-04-20T00:00:00.000Z' },
      serverType: 'managed', group: 'core', description: '运行中',
      status: { state: 'RUNNING', health: 'healthy', detail: null, uptimeSec: 3600, onlinePlayers: 5, maxPlayers: 20, version: '1.21.1' },
      capabilities: { terminal: { enabled: true, maxSessions: 3 }, files: { enabled: true, rootPath: '/srv' }, plugins: { enabled: true, pluginCount: 4 }, logs: { enabled: true, collectionCount: 2 }, audit: { enabled: true }, jvm: { enabled: true, helperAttached: false, jfrSupported: false }, minecraft: { enabled: true, isMinecraft: true, serverVersion: '1.21.1', probeConnected: false }, monitoring: { enabled: true, probeActive: true, jmxEnabled: false, alertRuleCount: 1 }, validation: { enabled: true } },
      availableActions: [{ key: 'stop', label: '停止', kind: 'primary', enabled: true }],
      latestValidationSummary: null,
    },
    {
      summary: { id: 'srv-stopped', kind: 'SERVER', name: 'Stopped Server', status: 'stopped', statusDetail: null, hostType: 'local', host: '127.0.0.1', port: 25566, tags: ['dev'], createdAt: '2026-04-20T00:00:00.000Z', updatedAt: '2026-04-20T00:00:00.000Z' },
      serverType: 'managed', group: 'dev', description: '已停止',
      status: { state: 'STOPPED', health: 'unknown', detail: null, uptimeSec: 0, onlinePlayers: 0, maxPlayers: 20, version: '1.21.1' },
      capabilities: { terminal: { enabled: true, maxSessions: 3 }, files: { enabled: true, rootPath: '/srv' }, plugins: { enabled: true, pluginCount: 4 }, logs: { enabled: true, collectionCount: 2 }, audit: { enabled: true }, jvm: { enabled: true, helperAttached: false, jfrSupported: false }, minecraft: { enabled: true, isMinecraft: true, serverVersion: '1.21.1', probeConnected: false }, monitoring: { enabled: true, probeActive: true, jmxEnabled: false, alertRuleCount: 1 }, validation: { enabled: true } },
      availableActions: [{ key: 'start', label: '启动', kind: 'primary', enabled: true }],
      latestValidationSummary: null,
    },
  ],
  summary: { total: 2, byKind: { SERVER: 2 }, byStatus: { running: 1, stopped: 1 }, byServerType: { managed: 2 } },
  page: 1, limit: 24, total: 2,
};

// ──────────────────────────────────────────────
// 测试 1: 面板显示
// ──────────────────────────────────────────────
test('运行中服务器卡片应显示实时指标面板', async ({ authedPage: page }) => {
  await page.route('**/api/v1/resources*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(singleServerPayload) });
  });
  await page.route('**/api/v1/metrics/overview*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(createOverview()) });
  });
  await page.route('**/api/v1/metrics/latest*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(createMetricSnapshot()) });
  });

  await page.goto('/resources');

  const card = page.locator('article[role="button"]').first();
  await expect(card).toContainText('在线玩家', { timeout: 10000 });
  await expect(card).toContainText('TPS');
  await expect(card).toContainText('内存');
  await expect(card).toContainText('CPU');
});

// ──────────────────────────────────────────────
// 测试 2: 数据值
// ──────────────────────────────────────────────
test('指标面板应显示正确的数据值', async ({ authedPage: page }) => {
  await page.route('**/api/v1/resources*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(singleServerPayload) });
  });
  await page.route('**/api/v1/metrics/overview*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(createOverview()) });
  });
  await page.route('**/api/v1/metrics/latest*', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(createMetricSnapshot({ onlinePlayers: 7, maxPlayers: 20, tps: 19.2, cpuUsage: 45.8, memoryUsageMb: 512, maxMemoryMb: 1024 })),
    });
  });

  await page.goto('/resources');

  const card = page.locator('article[role="button"]').first();
  await expect(card).toContainText('在线玩家', { timeout: 10000 });
  await expect(card).toContainText('7/20');
  await expect(card).toContainText('19.2');
  await expect(card).toContainText('512');
  await expect(card).toContainText('45.8%');
});

// ──────────────────────────────────────────────
// 测试 3: 每 5 秒自动刷新
// ──────────────────────────────────────────────
test('指标应每 5 秒自动刷新', async ({ authedPage: page }) => {
  let metricsCallCount = 0;

  await page.route('**/api/v1/resources*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(singleServerPayload) });
  });
  await page.route('**/api/v1/metrics/overview*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(createOverview()) });
  });
  await page.route('**/api/v1/metrics/latest*', async (route) => {
    metricsCallCount++;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(createMetricSnapshot()) });
  });

  await page.goto('/resources');

  const card = page.locator('article[role="button"]').first();
  await expect(card).toContainText('在线玩家', { timeout: 10000 });

  // 初始调用至少有一次
  expect(metricsCallCount).toBeGreaterThanOrEqual(1);

  // 等待 6 秒让定时器触发第二次刷新
  await page.waitForTimeout(6000);

  // 应该至少有 2 次调用（初始 + 至少 1 次刷新）
  expect(metricsCallCount).toBeGreaterThanOrEqual(2);
});

// ──────────────────────────────────────────────
// 测试 4: 数据过期提示
// ──────────────────────────────────────────────
test('指标超过 15 秒未更新应显示数据可能过期提示', async ({ authedPage: page }) => {
  let blockAfterFirst = false;

  await page.route('**/api/v1/resources*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(singleServerPayload) });
  });
  await page.route('**/api/v1/metrics/overview*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(createOverview()) });
  });
  await page.route('**/api/v1/metrics/latest*', async (route) => {
    if (blockAfterFirst) {
      // 阻塞请求模拟指标不再更新
      await new Promise(() => {});
      return;
    }
    blockAfterFirst = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(createMetricSnapshot()) });
  });

  await page.goto('/resources');

  const card = page.locator('article[role="button"]').first();
  await expect(card).toContainText('在线玩家', { timeout: 10000 });

  // 等待 20 秒让过期检测触发（15 秒阈值 + 缓冲）
  await page.waitForTimeout(20000);

  await expect(card).toContainText('数据可能过期');
});

// ──────────────────────────────────────────────
// 测试 5: 混合场景
// ──────────────────────────────────────────────
test('混合场景下仅运行中服务器显示指标面板', async ({ authedPage: page }) => {
  await page.route('**/api/v1/resources*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mixedPayload) });
  });
  await page.route('**/api/v1/metrics/overview*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(createOverview()) });
  });
  await page.route('**/api/v1/metrics/latest*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(createMetricSnapshot()) });
  });

  await page.goto('/resources');

  // 第一张卡片（运行中）应有指标面板
  const runningCard = page.locator('article[role="button"]').first();
  await expect(runningCard).toContainText('在线玩家', { timeout: 10000 });
  await expect(runningCard).toContainText('Running Server');

  // 第二张卡片（已停止）不应有指标面板
  const stoppedCard = page.locator('article[role="button"]').nth(1);
  await expect(stoppedCard).toContainText('Stopped Server');
  await expect(stoppedCard).not.toContainText('在线玩家');
});