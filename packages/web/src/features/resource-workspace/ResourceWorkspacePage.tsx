import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  ResourceActionDto,
  ResourceWorkspaceItemDto,
} from '@jian-agent/shared-domain';
import { remoteHostApi } from '../../api/remote-host.api.js';
import { serverApi } from '../../api/server.api.js';
import { metricsApi } from '../../api/metrics.api.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import { CreateHostModal } from '../../pages/remote-hosts/CreateHostModal.js';
import { CreateServerModal } from '../../pages/servers/CreateServerModal.js';
import {
  useResourceWorkspaceStore,
  type ResourceWorkspaceFilters,
} from './resource-workspace.store.js';
import type { LauncherMode } from './resource-helpers.js';
import { ResourceSummaryHeader } from './ResourceSummaryHeader.js';
import { ResourceFilterBar } from './ResourceFilterBar.js';
import { ResourceListView } from './ResourceListView.js';
import { ResourceOnboardingLauncher } from './ResourceOnboardingLauncher.js';
import { ResourcePagination } from './components/ResourcePagination.js';

interface ResourceWorkspacePageProps {
  readonly initialFilters?: ResourceWorkspaceFilters;
  readonly title?: string;
  readonly subtitle?: string;
}

export function ResourceWorkspacePage({
  initialFilters,
  title = '资源工作台',
  subtitle = '统一管理托管服务器、外置服务器与远程主机，并在同一入口查看动作、状态与验证摘要。',
}: ResourceWorkspacePageProps) {
  const navigate = useNavigate();
  const items = useResourceWorkspaceStore((state) => state.items);
  const summary = useResourceWorkspaceStore((state) => state.summary);
  const total = useResourceWorkspaceStore((state) => state.total);
  const page = useResourceWorkspaceStore((state) => state.page);
  const limit = useResourceWorkspaceStore((state) => state.limit);
  const filters = useResourceWorkspaceStore((state) => state.filters);
  const viewMode = useResourceWorkspaceStore((state) => state.viewMode);
  const selectedIds = useResourceWorkspaceStore((state) => state.selectedIds);
  const loading = useResourceWorkspaceStore((state) => state.loading);
  const error = useResourceWorkspaceStore((state) => state.error);
  const load = useResourceWorkspaceStore((state) => state.load);
  const setFilters = useResourceWorkspaceStore((state) => state.setFilters);
  const replaceFilters = useResourceWorkspaceStore((state) => state.replaceFilters);
  const setViewMode = useResourceWorkspaceStore((state) => state.setViewMode);
  const toggleSelected = useResourceWorkspaceStore((state) => state.toggleSelected);
  const clearSelection = useResourceWorkspaceStore((state) => state.clearSelection);
  const setPage = useResourceWorkspaceStore((state) => state.setPage);
  const setLimit = useResourceWorkspaceStore((state) => state.setLimit);

  const [launcherMode, setLauncherMode] = useState<LauncherMode>(null);
  const [healthByServer, setHealthByServer] = useState<Record<string, string>>({});
  const [tpsByServer, setTpsByServer] = useState<Record<string, number>>({});
  const [metricsByServer, setMetricsByServer] = useState<Record<string, any>>({});
  const [lastMetricsAt, setLastMetricsAt] = useState<Record<string, number>>({});

  useEffect(() => {
    if (initialFilters) {
      replaceFilters(initialFilters);
      return;
    }
    replaceFilters({});
  }, [initialFilters, replaceFilters]);

  useEffect(() => {
    void load();
  }, [filters, page, limit, load]);

  const runningServerIds = useMemo(
    () => items
      .filter((i) => i.summary.kind === 'SERVER' && i.summary.status === 'running')
      .map((i) => i.summary.id)
      .join('|'),
    [items]
  );

  useEffect(() => {
    const running = items.filter((i) => i.summary.kind === 'SERVER' && i.summary.status === 'running');
    if (running.length === 0) {
      setLastMetricsAt({});
      return;
    }
    
    const fetchMetrics = async () => {
      const now = Date.now();
      const [overviewResults, latestResults] = await Promise.all([
        Promise.allSettled(running.map((i) => metricsApi.getOverview(i.summary.id))),
        Promise.allSettled(running.map((i) => metricsApi.getLatest(i.summary.id))),
      ]);
      const hMap: Record<string, string> = {};
      const tMap: Record<string, number> = {};
      const mMap: Record<string, any> = {};
      const timeMap: Record<string, number> = {};
      running.forEach((item, idx) => {
        const ov = overviewResults[idx];
        if (ov.status === 'fulfilled' && ov.value) hMap[item.summary.id] = (ov.value as any).state ?? 'unknown';
        const lt = latestResults[idx];
        if (lt.status === 'fulfilled' && lt.value) {
          if (lt.value.tps != null) tMap[item.summary.id] = lt.value.tps;
          mMap[item.summary.id] = {
            onlinePlayers: lt.value.onlinePlayers ?? 0,
            maxPlayers: lt.value.maxPlayers ?? 0,
            usedMemoryMb: lt.value.memoryUsageMb ?? 0,
            maxMemoryMb: lt.value.maxMemoryMb ?? 0,
            cpuUsage: lt.value.cpuUsage ?? 0,
            tps: lt.value.tps ?? 0,
          };
          timeMap[item.summary.id] = now;
        }
      });
      setHealthByServer(hMap);
      setTpsByServer(tMap);
      setMetricsByServer(mMap);
      setLastMetricsAt(timeMap);
    };
    
    fetchMetrics();
    
    // 每 5 秒刷新运行中服务器的指标
    const intervalId = setInterval(() => {
      fetchMetrics();
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, [runningServerIds]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.summary.id)),
    [items, selectedIds],
  );

  const selectedServerIds = selectedItems
    .filter((item) => item.summary.kind === 'SERVER')
    .map((item) => item.summary.id);

  const handleAction = async (
    item: ResourceWorkspaceItemDto,
    action: ResourceActionDto,
  ) => {
    if (!action.enabled) {
      if (action.reason) {
        useDialogStore.getState().showToast(action.reason, 'info');
      }
      return;
    }

    try {
      switch (action.key) {
        case 'start':
          await serverApi.startServer(item.summary.id);
          break;
        case 'stop':
          await serverApi.stopServer(item.summary.id);
          break;
        case 'restart':
          await serverApi.restartServer(item.summary.id);
          break;
        case 'interrupt':
          await serverApi.interruptServer(item.summary.id);
          break;
        case 'delete': {
          const confirmed = await useDialogStore.getState().confirm({
            title: '删除资源',
            message: `确定删除 ${item.summary.name} 吗？此操作不可撤销。`,
            variant: 'danger',
            confirmLabel: '确认删除',
          });
          if (!confirmed) {
            return;
          }
          if (item.summary.kind === 'REMOTE_HOST') {
            await remoteHostApi.delete(item.summary.id);
          } else {
            await serverApi.deleteServer(item.summary.id);
          }
          break;
        }
        case 'ping':
          await serverApi.pingServer(item.summary.id);
          break;
        case 'test-connection':
          await remoteHostApi.testConnection(item.summary.id);
          break;
        case 'terminal':
        case 'ssh-terminal':
          navigate(`/resources/${item.summary.id}/terminal`);
          return;
        case 'files':
          navigate(`/resources/${item.summary.id}/files`);
          return;
        case 'validation':
        case 'validation-view':
          navigate(`/resources/${item.summary.id}/validation`);
          return;
        case 'open-detail':
          navigate(`/resources/${item.summary.id}`);
          return;
        default:
          navigate(`/resources/${item.summary.id}`);
          return;
      }
      await load();
    } catch (err: any) {
      useDialogStore
        .getState()
        .showToast(err.message ?? `${action.label} 失败`, 'error');
    }
  };

  const handleBatchAction = async (
    action: 'start' | 'stop' | 'restart' | 'delete',
  ) => {
    if (selectedServerIds.length === 0) {
      return;
    }

    try {
      if (action === 'delete') {
        const confirmed = await useDialogStore.getState().confirm({
          title: '批量删除服务器',
          message: `确定删除选中的 ${selectedServerIds.length} 台服务器？此操作不可撤销。`,
          variant: 'danger',
          confirmLabel: '全部删除',
        });
        if (!confirmed) {
          return;
        }
      }

      await serverApi.batchOperation(action, selectedServerIds);
      clearSelection();
      await load();
    } catch (err: any) {
      useDialogStore
        .getState()
        .showToast(err.message ?? `批量${action}失败`, 'error');
    }
  };

  const handleQuickFilter = (status: string | undefined) => {
    setFilters({ status });
  };

  return (
    <div className="space-y-4 p-4 md:p-6" data-testid="resource-workspace-page">
      <ResourceSummaryHeader
        title={title}
        subtitle={subtitle}
        summary={summary}
        total={total}
        page={page}
        limit={limit}
        currentStatus={filters.status}
        onAddResource={() => setLauncherMode('launcher')}
        onRefresh={() => void load()}
        onQuickFilter={handleQuickFilter}
      />

      <ResourceFilterBar
        filters={filters}
        viewMode={viewMode}
        selectedServerCount={selectedServerIds.length}
        error={error}
        onSetFilters={setFilters}
        onSetViewMode={setViewMode}
        onBatchAction={(action) => void handleBatchAction(action)}
        onClearSelection={clearSelection}
      />

      <ResourceListView
        items={items}
        viewMode={viewMode}
        selectedIds={selectedIds}
        loading={loading}
        healthByServer={healthByServer}
        tpsByServer={tpsByServer}
        metricsByServer={metricsByServer}
        lastMetricsAt={lastMetricsAt}
        onToggleSelected={toggleSelected}
        onAction={(item, action) => void handleAction(item, action)}
      />

      <ResourcePagination
        page={page}
        limit={limit}
        total={total}
        onPageChange={(newPage) => {
          setPage(newPage);
        }}
        onLimitChange={(newLimit) => {
          setLimit(newLimit);
        }}
      />

      {launcherMode === 'launcher' ? (
        <ResourceOnboardingLauncher
          onClose={() => setLauncherMode(null)}
          onSelect={(mode) => setLauncherMode(mode)}
        />
      ) : null}

      <CreateServerModal
        open={launcherMode === 'managed-existing'}
        onClose={() => {
          setLauncherMode(null);
          void load();
        }}
        initialServerType="managed"
        title="纳管现有托管服务器目录"
      />

      <CreateServerModal
        open={launcherMode === 'managed-paper'}
        onClose={() => {
          setLauncherMode(null);
          void load();
        }}
        initialServerType="managed"
        title="初始化新的 Paper 托管服务器"
      />

      <CreateServerModal
        open={launcherMode === 'external-server'}
        onClose={() => {
          setLauncherMode(null);
          void load();
        }}
        initialServerType="external"
        title="纳管运行中的外置服务器"
      />

      <CreateHostModal
        open={launcherMode === 'remote-host'}
        onClose={() => setLauncherMode(null)}
        onCreated={() => {
          setLauncherMode(null);
          void load();
        }}
        title="通过 SSH 接入远程主机"
      />
    </div>
  );
}
