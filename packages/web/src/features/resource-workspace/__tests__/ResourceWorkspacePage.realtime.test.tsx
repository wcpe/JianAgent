/**
 * @vitest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ResourceWorkspaceItemDto } from '@jian-agent/shared-domain';
import { ResourceWorkspacePage } from '../ResourceWorkspacePage.js';
import { useResourceWorkspaceStore } from '../resource-workspace.store.js';

const mockGetOverview = vi.fn();
const mockGetLatest = vi.fn();
const mockLoad = vi.fn().mockResolvedValue(undefined);
const mockSetFilters = vi.fn();
const mockReplaceFilters = vi.fn();
const mockSetViewMode = vi.fn();
const mockToggleSelected = vi.fn();
const mockClearSelection = vi.fn();

vi.mock('../../../api/metrics.api.js', () => ({
  metricsApi: {
    getOverview: (...args: any[]) => mockGetOverview(...args),
    getLatest: (...args: any[]) => mockGetLatest(...args),
  },
}));

vi.mock('../../../stores/dialog.store.js', () => ({
  useDialogStore: {
    getState: () => ({
      showToast: vi.fn(),
      confirm: vi.fn().mockResolvedValue(true),
    }),
  },
}));

vi.mock('../../../api/server.api.js', () => ({
  serverApi: {
    deleteServer: vi.fn().mockResolvedValue(undefined),
    batchOperation: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../api/remote-host.api.js', () => ({
  remoteHostApi: {
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

const runningServer: ResourceWorkspaceItemDto = {
  summary: {
    id: 'srv-running',
    kind: 'SERVER',
    name: 'Running Server',
    status: 'running',
    statusDetail: null,
    hostType: 'local',
    host: '127.0.0.1',
    port: 25565,
    tags: [],
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
  },
  serverType: 'managed',
  group: null,
  description: null,
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
  availableActions: [],
  latestValidationSummary: null,
};

const stoppedServer: ResourceWorkspaceItemDto = {
  ...runningServer,
  summary: {
    ...runningServer.summary,
    id: 'srv-stopped',
    name: 'Stopped Server',
    status: 'stopped',
  },
  status: {
    ...runningServer.status,
    state: 'STOPPED',
  },
};

describe('ResourceWorkspacePage - Realtime Metrics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-28T10:00:00.000Z'));
    vi.clearAllMocks();
    
    mockGetOverview.mockResolvedValue({ state: 'healthy' });
    mockGetLatest.mockResolvedValue({
      onlinePlayers: 5,
      maxPlayers: 20,
      memoryUsageMb: 256,
      maxMemoryMb: 1024,
      cpuUsage: 12.5,
      tps: 19.8,
    });

    useResourceWorkspaceStore.setState({
      items: [runningServer],
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
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('应该每 5 秒刷新运行中服务器的指标', async () => {
    render(
      <MemoryRouter>
        <ResourceWorkspacePage />
      </MemoryRouter>
    );

    await vi.waitFor(() => {
      expect(mockGetLatest).toHaveBeenCalledWith('srv-running');
    }, { timeout: 1000 });

    const initialCallCount = mockGetLatest.mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(mockGetLatest).toHaveBeenCalledTimes(initialCallCount + 1);

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(mockGetLatest).toHaveBeenCalledTimes(initialCallCount + 2);
  });

  it('应该在服务器停止后清理定时器', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <ResourceWorkspacePage />
      </MemoryRouter>
    );

    await vi.waitFor(() => {
      expect(mockGetLatest).toHaveBeenCalled();
    }, { timeout: 1000 });

    const callCountBeforeStop = mockGetLatest.mock.calls.length;

    act(() => {
      useResourceWorkspaceStore.setState({
        items: [stoppedServer],
      });
    });

    rerender(
      <MemoryRouter>
        <ResourceWorkspacePage />
      </MemoryRouter>
    );

    await act(async () => {
      vi.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    expect(mockGetLatest).toHaveBeenCalledTimes(callCountBeforeStop);
  });

  it('应该在组件卸载时清理定时器', async () => {
    const { unmount } = render(
      <MemoryRouter>
        <ResourceWorkspacePage />
      </MemoryRouter>
    );

    await vi.waitFor(() => {
      expect(mockGetLatest).toHaveBeenCalled();
    }, { timeout: 1000 });

    const callCountBeforeUnmount = mockGetLatest.mock.calls.length;

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    expect(mockGetLatest).toHaveBeenCalledTimes(callCountBeforeUnmount);
  });

  it('应该在指标超过 15 秒未更新时显示过期提示', async () => {
    render(
      <MemoryRouter>
        <ResourceWorkspacePage />
      </MemoryRouter>
    );

    await vi.waitFor(() => {
      expect(screen.getByText('Running Server')).toBeInTheDocument();
    }, { timeout: 1000 });

    expect(screen.queryByText(/数据可能过期/i)).not.toBeInTheDocument();

    // 前进 16 秒（超过 15 秒阈值）
    await act(async () => {
      vi.advanceTimersByTime(16000);
      vi.setSystemTime(Date.now() + 16000);
      await Promise.resolve();
    });

    // 应该显示过期提示
    expect(screen.getByText(/数据可能过期/i)).toBeInTheDocument();
  });

  it('应该在指标刷新后清除过期提示', async () => {
    render(
      <MemoryRouter>
        <ResourceWorkspacePage />
      </MemoryRouter>
    );

    await vi.waitFor(() => {
      expect(screen.getByText('Running Server')).toBeInTheDocument();
    }, { timeout: 1000 });

    // 前进 16 秒显示过期提示
    await act(async () => {
      vi.advanceTimersByTime(16000);
      vi.setSystemTime(Date.now() + 16000);
      await Promise.resolve();
    });

    expect(screen.getByText(/数据可能过期/i)).toBeInTheDocument();

    // 前进到下一次刷新（5 秒间隔）
    // 这会触发 fetchMetrics，更新 lastMetricsAt
    await act(async () => {
      vi.advanceTimersByTime(5000);
      vi.setSystemTime(Date.now() + 5000);
      await Promise.resolve();
    });

    // 过期提示应该消失
    expect(screen.queryByText(/数据可能过期/i)).not.toBeInTheDocument();
  });
});
