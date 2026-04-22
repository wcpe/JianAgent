import { test, expect } from '../../e2e/fixtures.js';

test('loads the local validation workspace and shows mocked stage progress', async ({ authedPage: page }) => {
  await page.route('**/api/local-validation/scenario-packs', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'combat-pack-v1',
          name: '综合对抗验收包',
          description: '覆盖出生、移动、聊天、交互、PvP、死亡、重生',
          stages: [],
        },
      ]),
    });
  });

  await page.route('**/api/local-validation/runs', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'lvr_001',
          name: 'Paper smoke',
          mode: 'init-paper',
          status: 'READY',
          scenarioPackId: 'combat-pack-v1',
          requestedBotCount: 8,
          effectiveBotCount: 8,
          requestedBy: 'qa',
          keepServerRunning: false,
          keepWorkspace: true,
          workspacePath: '/tmp/jianagent/lvr_001',
          startedAt: '2026-04-19T10:00:00.000Z',
        },
      ]),
    });
  });

  await page.route('**/api/local-validation/runs/lvr_001/stages', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'lvs_001',
          runId: 'lvr_001',
          stageKey: 'movement-and-chat',
          title: 'Movement and Chat',
          status: 'passed',
          timeoutMs: 90000,
          botGroupSnapshot: [{ name: 'alpha', botNames: ['bot-a', 'bot-b'] }],
          assertionSummary: { total: 1, passed: 1, failed: 0 },
          startedAt: '2026-04-19T10:00:05.000Z',
          finishedAt: '2026-04-19T10:01:05.000Z',
        },
      ]),
    });
  });

  await page.route('**/api/local-validation/runs/lvr_001/assertions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'lva_001',
          runId: 'lvr_001',
          stageId: 'lvs_001',
          key: 'movement-chat-ratio',
          title: 'Movement and Chat ratio',
          required: true,
          status: 'passed',
          threshold: 0.9,
          actual: 1,
          message: 'All bots moved and chatted',
          evidenceRefs: ['lve_001'],
        },
      ]),
    });
  });

  await page.route('**/api/local-validation/runs/lvr_001/evidence', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'lve_001',
          runId: 'lvr_001',
          kind: 'server-log',
          timestamp: '2026-04-19T10:00:07.000Z',
          summary: 'Paper logged the ready banner',
          payload: {
            line: '[Server thread/INFO]: Done (3.1s)!',
          },
        },
      ]),
    });
  });

  await page.goto('/local-validation');

  await expect(page.getByRole('heading', { name: '本地验证运行台' })).toBeVisible();
  await expect(page.getByLabel('场景包')).toHaveValue('combat-pack-v1');

  await page.getByRole('button', { name: /Paper smoke/i }).click();

  await expect(page.getByRole('heading', { name: 'Movement and Chat' })).toBeVisible();
  await expect(page.getByText('Movement and Chat ratio')).toBeVisible();
  await expect(page.getByText('Paper logged the ready banner')).toBeVisible();
  await expect(page.getByText(/\[Server thread\/INFO\]: Done \(3\.1s\)!/)).toBeVisible();
});
