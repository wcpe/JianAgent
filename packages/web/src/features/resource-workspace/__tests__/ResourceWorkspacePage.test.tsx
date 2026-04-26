/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ResourceWorkspaceItemDto } from '@jian-agent/shared-domain';
import { ResourceWorkspacePage } from '../ResourceWorkspacePage.js';

const mockLoad = vi.fn().mockResolvedValue(undefined);
const mockSetFilters = vi.fn();
const mockReplaceFilters = vi.fn();
const mockSetViewMode = vi.fn();
const mockToggleSelected = vi.fn();
const mockClearSelection = vi.fn();

const storeState = {
  items: [
    {
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
        logs: { enabled: true, collectionCount: 2 },
        audit: { enabled: true },
        jvm: { enabled: true, helperAttached: false, jfrSupported: false },
        minecraft: { enabled: true, isMinecraft: true, serverVersion: '1.21.1', probeConnected: false },
        monitoring: { enabled: true, probeActive: true, jmxEnabled: false, alertRuleCount: 1 },
        validation: { enabled: true },
      },
      availableActions: [
        { key: 'start', label: '启动', kind: 'primary', enabled: false, reason: '服务器已在运行' },
        { key: 'terminal', label: '终端', kind: 'navigation', enabled: true },
        { key: 'validation', label: '验证', kind: 'navigation', enabled: true },
      ],
      latestValidationSummary: {
        state: 'PASSED',
        verdict: 'passed',
        finishedAt: '2026-04-20T00:10:00.000Z',
        runId: 'lvr_001',
      },
    },
  ] satisfies ResourceWorkspaceItemDto[],
  summary: {
    total: 1,
    byKind: { SERVER: 1 },
    byStatus: { running: 1 },
    byServerType: { managed: 1 },
  },
  total: 1,
  page: 1,
  limit: 24,
  filters: {},
  viewMode: 'card',
  selectedIds: [],
  loading: false,
  error: null,
  load: mockLoad,
  setFilters: mockSetFilters,
  replaceFilters: mockReplaceFilters,
  setViewMode: mockSetViewMode,
  toggleSelected: mockToggleSelected,
  clearSelection: mockClearSelection,
};

vi.mock('../resource-workspace.store.js', () => ({
  useResourceWorkspaceStore: (selector: (state: typeof storeState) => unknown) =>
    selector(storeState),
}));

vi.mock('../../../pages/servers/CreateServerModal.js', () => ({
  CreateServerModal: () => <div>server-modal</div>,
}));

vi.mock('../../../pages/remote-hosts/CreateHostModal.js', () => ({
  CreateHostModal: () => <div>host-modal</div>,
}));

describe('ResourceWorkspacePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders unified resource workspace items and validation badge', async () => {
    render(
      <MemoryRouter>
        <ResourceWorkspacePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('资源工作台')).toBeTruthy();
    expect(screen.getByText('Managed Alpha')).toBeTruthy();
    expect(screen.getByText('最近验证通过')).toBeTruthy();

    await waitFor(() => {
      expect(mockLoad).toHaveBeenCalled();
    });
  });
});
