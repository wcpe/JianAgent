/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ResourceWorkspaceItemDto } from '@jian-agent/shared-domain';
import { ResourceListView } from '../ResourceListView.js';

const runningItem = {
  summary: {
    id: 'srv-running',
    kind: 'SERVER',
    name: 'Running Server',
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
    logs: { enabled: true, collectionCount: 2 },
    audit: { enabled: true },
    jvm: { enabled: true, helperAttached: false, jfrSupported: false },
    minecraft: { enabled: true, isMinecraft: true, serverVersion: '1.21.1', probeConnected: false },
    monitoring: { enabled: true, probeActive: true, jmxEnabled: false, alertRuleCount: 1 },
    validation: { enabled: true },
  },
  availableActions: [
    { key: 'terminal', label: '终端', kind: 'navigation', enabled: true },
  ],
  latestValidationSummary: {
    state: 'PASSED',
    verdict: 'passed',
    finishedAt: '2026-04-20T00:10:00.000Z',
    runId: 'lvr_001',
  },
} satisfies ResourceWorkspaceItemDto;

describe('ResourceListView metrics', () => {
  it('renders memory using usedMemoryMb and maxMemoryMb for running card', () => {
    render(
      <MemoryRouter>
        <ResourceListView
          items={[runningItem]}
          viewMode="card"
          selectedIds={[]}
          loading={false}
          metricsByServer={{
            'srv-running': {
              usedMemoryMb: 256,
              maxMemoryMb: 1024,
              memoryUsageMb: 999,
              onlinePlayers: 5,
              maxPlayers: 20,
              cpuUsage: 15,
              tps: 19.8,
            },
          }}
          healthByServer={{ 'srv-running': 'healthy' }}
          tpsByServer={{ 'srv-running': 19.8 }}
          onToggleSelected={vi.fn()}
          onAction={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('256MB / 1024MB')).toBeTruthy();
    expect(screen.queryByText('999MB / 1024MB')).toBeNull();
  });
});
