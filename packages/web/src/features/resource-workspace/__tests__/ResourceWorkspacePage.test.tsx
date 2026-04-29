/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ResourceWorkspaceItemDto } from '@jian-agent/shared-domain';
import { ResourceWorkspacePage } from '../ResourceWorkspacePage.js';
import { useResourceWorkspaceStore } from '../resource-workspace.store.js';

const mockGetOverview = vi.fn().mockResolvedValue({ state: 'healthy' });
const mockGetLatest = vi.fn().mockResolvedValue({
  onlinePlayers: 5,
  maxPlayers: 20,
  memoryUsageMb: 256,
  maxMemoryMb: 1024,
  cpuUsage: 12.5,
  tps: 19.8,
});

const mockLoad = vi.fn().mockResolvedValue(undefined);
const mockSetFilters = vi.fn();
const mockReplaceFilters = vi.fn();
const mockSetViewMode = vi.fn();
const mockToggleSelected = vi.fn();
const mockClearSelection = vi.fn();
const mockShowToast = vi.fn();
const mockConfirm = vi.fn().mockResolvedValue(true);
const mockDeleteServer = vi.fn().mockResolvedValue(undefined);
const mockDeleteRemoteHost = vi.fn().mockResolvedValue(undefined);
const mockBatchOperation = vi.fn().mockResolvedValue(undefined);

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
        { key: 'delete', label: '删除', kind: 'dangerous', enabled: true },
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

vi.mock('../../../api/metrics.api.js', () => ({
  metricsApi: {
    getOverview: (...args: unknown[]) => mockGetOverview(...args),
    getLatest: (...args: unknown[]) => mockGetLatest(...args),
  },
}));

vi.mock('../../../api/server.api.js', () => ({
  serverApi: {
    deleteServer: (...args: unknown[]) => mockDeleteServer(...args),
    batchOperation: (...args: unknown[]) => mockBatchOperation(...args),
  },
}));

vi.mock('../../../api/remote-host.api.js', () => ({
  remoteHostApi: {
    delete: (...args: unknown[]) => mockDeleteRemoteHost(...args),
  },
}));

vi.mock('../../../stores/dialog.store.js', () => ({
  useDialogStore: Object.assign(
    (selector: (state: { showToast: typeof mockShowToast }) => unknown) =>
      selector({ showToast: mockShowToast }),
    {
      getState: () => ({
        showToast: mockShowToast,
        confirm: mockConfirm,
      }),
    },
  ),
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
    // 重置 storeState
    storeState.selectedIds = [];
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

  it('renders running card memory values from latest metrics', async () => {
    render(
      <MemoryRouter>
        <ResourceWorkspacePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('256MB / 1024MB')).toBeTruthy();
    });
  });

  it('单项删除时触发 confirm dialog', async () => {
    render(
      <MemoryRouter>
        <ResourceWorkspacePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('删除')).toBeTruthy();
    });

    const deleteButtons = screen.getAllByText('删除');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '删除资源',
          message: expect.stringContaining('Managed Alpha'),
          variant: 'danger',
          confirmLabel: '确认删除',
        }),
      );
    });
  });

  it('单项删除时，用户点击取消则不调用 delete API', async () => {
    mockConfirm.mockResolvedValueOnce(false);

    render(
      <MemoryRouter>
        <ResourceWorkspacePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('删除')).toBeTruthy();
    });

    const deleteButtons = screen.getAllByText('删除');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
      expect(mockDeleteServer).not.toHaveBeenCalled();
    });
  });

  it('单项删除时，用户点击确认则调用 delete API', async () => {
    mockConfirm.mockResolvedValueOnce(true);

    render(
      <MemoryRouter>
        <ResourceWorkspacePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('删除')).toBeTruthy();
    });

    const deleteButtons = screen.getAllByText('删除');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
      expect(mockDeleteServer).toHaveBeenCalledWith('srv-managed');
    });
  });

  it('批量删除时触发 confirm dialog', async () => {
    // 修改 storeState 以包含选中的 ID
    storeState.selectedIds = ['srv-managed'];

    render(
      <MemoryRouter>
        <ResourceWorkspacePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const batchDeleteButtons = screen.getAllByText('批量删除');
      expect(batchDeleteButtons.length).toBeGreaterThan(0);
    });

    const deleteButtons = screen.getAllByText('批量删除');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '批量删除服务器',
          message: expect.stringContaining('1'),
          variant: 'danger',
          confirmLabel: '全部删除',
        }),
      );
    });
  });

  it('批量删除时，用户点击取消则不调用 batchOperation', async () => {
    mockConfirm.mockResolvedValueOnce(false);

    // 修改 storeState 以包含选中的 ID
    storeState.selectedIds = ['srv-managed'];

    render(
      <MemoryRouter>
        <ResourceWorkspacePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const batcdhDeleteButtons = screen.getAllByText('批量删除');
      expect(batcdhDeleteButtons.length).toBeGreaterThan(0);
    });

    const deleteButtons = screen.getAllByText('批量删除');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
      expect(mockBatchOperation).not.toHaveBeenCalled();
    });
  });

  it('点击运行中摘要卡片应用 running 筛选', async () => {
    render(
      <MemoryRouter>
        <ResourceWorkspacePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('运行中')).toBeTruthy();
    });

    const runningCard = screen.getByText('运行中').closest('button');
    expect(runningCard).toBeTruthy();
    fireEvent.click(runningCard!);

    await waitFor(() => {
      expect(mockSetFilters).toHaveBeenCalledWith({ status: 'running' });
    });
  });

  it('点击已停止摘要卡片应用 stopped 筛选', async () => {
    render(
      <MemoryRouter>
        <ResourceWorkspacePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('已停止')).toBeTruthy();
    });

    const stoppedCard = screen.getByText('已停止').closest('button');
    expect(stoppedCard).toBeTruthy();
    fireEvent.click(stoppedCard!);

    await waitFor(() => {
      expect(mockSetFilters).toHaveBeenCalledWith({ status: 'stopped' });
    });
  });

  it('点击异常摘要卡片应用 error 筛选', async () => {
    render(
      <MemoryRouter>
        <ResourceWorkspacePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('异常')).toBeTruthy();
    });

    const errorCard = screen.getByText('异常').closest('button');
    expect(errorCard).toBeTruthy();
    fireEvent.click(errorCard!);

    await waitFor(() => {
      expect(mockSetFilters).toHaveBeenCalledWith({ status: 'error' });
    });
  });

  it('点击全部资源卡片清空状态筛选', async () => {
    // 先设置一个筛选状态
    storeState.filters = { status: 'running' };

    render(
      <MemoryRouter>
        <ResourceWorkspacePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('资源总数')).toBeTruthy();
    });

    const totalCard = screen.getByText('资源总数').closest('button');
    expect(totalCard).toBeTruthy();
    fireEvent.click(totalCard!);

    await waitFor(() => {
      expect(mockSetFilters).toHaveBeenCalledWith({ status: undefined });
    });
  });

  it('当前筛选状态在摘要卡片上高亮显示', async () => {
    storeState.filters = { status: 'running' };

    render(
      <MemoryRouter>
        <ResourceWorkspacePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const runningCard = screen.getByText('运行中').closest('button');
      expect(runningCard).toBeTruthy();
      expect(runningCard?.className).toContain('border-primary-500');
      expect(runningCard?.className).toContain('bg-primary-50');
    });
  });
});
