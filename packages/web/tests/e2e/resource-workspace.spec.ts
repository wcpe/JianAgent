import { test, expect } from '../../e2e/fixtures.js';

function createWorkspacePayload(kind?: string) {
  const managed = {
    summary: {
      id: 'srv-managed',
      kind: 'SERVER',
      name: 'Managed Alpha',
      status: 'running',
      statusDetail: null,
      hostType: 'local',
      host: '127.0.0.1',
      port: 25565,
      tags: ['prod'],
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
    },
    serverType: 'managed',
    group: 'core',
    description: 'Managed server',
    status: {
      state: 'RUNNING',
      health: 'healthy',
      detail: null,
      uptimeSec: 120,
      onlinePlayers: 5,
      maxPlayers: 20,
      version: '1.21.1',
    },
    capabilities: {
      terminal: { enabled: true, maxSessions: 3 },
      files: { enabled: true, rootPath: '/srv' },
      plugins: { enabled: true, pluginCount: 4 },
      logs: { enabled: true, collectionCount: 1 },
      audit: { enabled: true },
      jvm: { enabled: true, helperAttached: false, jfrSupported: false },
      minecraft: { enabled: true, isMinecraft: true, serverVersion: '1.21.1', probeConnected: false },
      monitoring: { enabled: true, probeActive: true, jmxEnabled: false, alertRuleCount: 1 },
      validation: { enabled: true },
    },
    availableActions: [
      { key: 'terminal', label: '终端', kind: 'navigation', enabled: true },
      { key: 'validation', label: '验证', kind: 'navigation', enabled: true },
    ],
    latestValidationSummary: {
      state: 'PASSED',
      verdict: 'passed',
      finishedAt: '2026-04-20T00:10:00.000Z',
      runId: 'lvr_001',
    },
  };

  const host = {
    summary: {
      id: 'host-1',
      kind: 'REMOTE_HOST',
      name: 'SSH Bastion',
      status: 'online',
      statusDetail: null,
      hostType: 'remote',
      host: '192.168.0.10',
      port: 22,
      tags: ['ops'],
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
    },
    serverType: null,
    group: null,
    description: 'Operations bastion',
    status: {
      state: 'RUNNING',
      health: 'healthy',
      detail: null,
      uptimeSec: null,
      onlinePlayers: null,
      maxPlayers: null,
      version: null,
    },
    capabilities: {
      terminal: { enabled: true, maxSessions: 1 },
      files: { enabled: false, rootPath: null },
      plugins: { enabled: false, pluginCount: 0 },
      logs: { enabled: false, collectionCount: 0 },
      audit: { enabled: false },
      jvm: { enabled: false, helperAttached: false, jfrSupported: false },
      minecraft: { enabled: false, isMinecraft: false, serverVersion: null, probeConnected: false },
      monitoring: { enabled: true, probeActive: false, jmxEnabled: false, alertRuleCount: 0 },
      validation: { enabled: false },
    },
    availableActions: [
      { key: 'test-connection', label: '连接测试', kind: 'secondary', enabled: true },
      { key: 'ssh-terminal', label: 'SSH 终端', kind: 'navigation', enabled: true },
    ],
    latestValidationSummary: null,
  };

  const items =
    kind === 'SERVER'
      ? [managed]
      : kind === 'REMOTE_HOST'
        ? [host]
        : [managed, host];

  return {
    items,
    summary: {
      total: items.length,
      byKind: {
        SERVER: items.filter((item) => item.summary.kind === 'SERVER').length,
        REMOTE_HOST: items.filter((item) => item.summary.kind === 'REMOTE_HOST').length,
      },
      byStatus: {
        running: items.length,
      },
      byServerType: {
        managed: items.filter((item) => item.serverType === 'managed').length,
        'remote-host': items.filter((item) => item.serverType === null).length,
      },
    },
    page: 1,
    limit: 24,
    total: items.length,
  };
}

test('resource workspace, legacy wrappers, and validation detail entry work together', async ({ authedPage: page }) => {
  await page.route('**/api/v1/resources/srv-managed', async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.endsWith('/api/v1/resources/srv-managed')) {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'srv-managed',
        kind: 'SERVER',
        name: 'Managed Alpha',
        serverType: 'managed',
        hostType: 'local',
        host: '127.0.0.1',
        port: 25565,
        tags: ['prod'],
        createdAt: '2026-04-20T00:00:00.000Z',
        updatedAt: '2026-04-20T00:00:00.000Z',
        status: {
          state: 'RUNNING',
          health: 'healthy',
          detail: null,
          uptimeSec: 120,
          onlinePlayers: 5,
          maxPlayers: 20,
          version: '1.21.1',
        },
        capabilities: {
          terminal: { enabled: true, maxSessions: 3 },
          files: { enabled: true, rootPath: '/srv' },
          plugins: { enabled: true, pluginCount: 4 },
          logs: { enabled: true, collectionCount: 1 },
          audit: { enabled: true },
          jvm: { enabled: true, helperAttached: false, jfrSupported: false },
          minecraft: { enabled: true, isMinecraft: true, serverVersion: '1.21.1', probeConnected: false },
          monitoring: { enabled: true, probeActive: true, jmxEnabled: false, alertRuleCount: 1 },
          validation: { enabled: true },
        },
        availableActions: [
          { key: 'terminal', label: '终端', kind: 'navigation', enabled: true },
          { key: 'validation', label: '验证', kind: 'navigation', enabled: true },
        ],
        latestValidationSummary: {
          state: 'PASSED',
          verdict: 'passed',
          finishedAt: '2026-04-20T00:10:00.000Z',
          runId: 'lvr_001',
        },
        dependencies: [],
        dependents: [],
      }),
    });
  });

  await page.route(/.*\/api\/v1\/resources(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const kind = url.searchParams.get('kind') ?? undefined;

    if (!url.pathname.endsWith('/api/v1/resources')) {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createWorkspacePayload(kind)),
    });
  });

  await page.route('**/api/v1/local-validation/runs', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'lvr_001',
          name: 'Managed Alpha validation',
          mode: 'init-paper',
          serverId: 'srv-managed',
          status: 'PASSED',
          scenarioPackId: 'combat-pack-v1',
          requestedBotCount: 8,
          effectiveBotCount: 8,
          requestedBy: 'qa',
          keepServerRunning: false,
          keepWorkspace: true,
          workspacePath: '/tmp/lvr_001',
          finishedAt: '2026-04-20T00:10:00.000Z',
        },
      ]),
    });
  });

  await page.goto('/resources');
  await expect(page.getByRole('heading', { name: '资源工作台' })).toBeVisible();
  await expect(page.getByText('Managed Alpha')).toBeVisible();
  await expect(page.getByText('SSH Bastion')).toBeVisible();

  await page.goto('/servers');
  await expect(page.getByRole('heading', { name: '服务器工作台' })).toBeVisible();
  await expect(page.getByText('Managed Alpha')).toBeVisible();
  await expect(page.getByText('SSH Bastion')).toHaveCount(0);

  await page.goto('/remote-hosts');
  await expect(page.getByRole('heading', { name: '远程主机' })).toBeVisible();
  await expect(page.getByText('SSH Bastion')).toBeVisible();
  await expect(page.getByText('Managed Alpha')).toHaveCount(0);

  await page.goto('/resources/srv-managed/validation');
  await expect(page.getByRole('heading', { name: '验证与治理' })).toBeVisible();
  await expect(page.getByText('Managed Alpha validation')).toBeVisible();
  await expect(page.getByRole('button', { name: '打开本地验证运行台' })).toBeVisible();
});
