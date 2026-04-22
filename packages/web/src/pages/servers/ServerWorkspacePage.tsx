import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServerStore } from '../../stores/server.store.js';
import { useServerRealtime } from '../../hooks/useServerRealtime.js';
import { useWsChannel } from '../../ws/use-ws-channel.js';
import { EmptyState } from '../../components/EmptyState.js';
import { ErrorState } from '../../components/ErrorState.js';
import { ServerCardGrid } from './ServerCardGrid.js';
import { ServerTableView } from './ServerTableView.js';
import { CreateServerDrawer } from './CreateServerDrawer.js';
import { EditServerDrawer } from './EditServerDrawer.js';
import { StyledSelect } from '../../components/ui/StyledSelect.js';
import { ServerGroupFilter } from './ServerGroupFilter.js';
import { BatchOperationBar } from '../../features/server-lifecycle/BatchOperationBar.js';
import { serverApi } from '../../api/server.api.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import type { ServerWithStatusDto } from '@jian-agent/shared-domain';

export function ServerWorkspacePage() {
  const {
    servers, viewMode, filter, loading, error,
    fetchServers, setViewMode, setFilter,
  } = useServerStore();

  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ServerWithStatusDto | null>(null);
  const [groupFilter, setGroupFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const handleStatusUpdate = useCallback(
    (payload: { serverId: string; status: string }) => {
      useServerStore.getState().patchServerStatus(payload.serverId, {
        runtimeStatus: payload.status as any,
      });
    },
    [],
  );
  useWsChannel('resource:server:status', handleStatusUpdate);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const batchAction = useCallback(async (action: 'start' | 'stop' | 'restart' | 'delete') => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    if (action === 'delete') {
      const ok = await useDialogStore.getState().confirm({
        title: '批量删除服务器',
        message: `确定删除选中的 ${ids.length} 个服务器？此操作不可撤销。`,
        variant: 'danger',
        confirmLabel: '全部删除',
      });
      if (!ok) return;
    }

    setBatchLoading(true);
    try {
      const result = await serverApi.batchOperation(action, ids);
      const failed = result.results.filter((r) => !r.success);
      if (failed.length > 0) {
        alert(`${action} 操作完成，${failed.length} 个失败：\n${failed.map((f) => `${f.serverId}: ${f.error}`).join('\n')}`);
      }
      clearSelection();
      fetchServers();
    } catch (err: any) {
      alert(`批量操作失败: ${err.message}`);
    } finally {
      setBatchLoading(false);
    }
  }, [selectedIds, clearSelection, fetchServers]);

  // Compute unique groups from servers
  const uniqueGroups = [...new Set(servers.map((s) => s.serverGroup).filter((g): g is string => !!g))];

  const filtered = servers.filter((s) => {
    if (filter.search && !s.name.toLowerCase().includes(filter.search.toLowerCase())) return false;
    if (filter.status && s.runtimeStatus !== filter.status) return false;
    if (groupFilter && s.serverGroup !== groupFilter) return false;
    return true;
  });

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">服务器工作台</h1>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm p-3">
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setCreateOpen(true)}
            className="px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 active:scale-95 transition-all duration-150 font-medium shadow-sm"
          >
            新建服务器
          </button>
          <input
            placeholder="搜索名称..."
            value={filter.search}
            onChange={(e) => setFilter({ search: e.target.value })}
            className="border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-slate-900/60 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm w-40 md:w-48 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-300 backdrop-blur-md shadow-sm transition-all"
          />
          <StyledSelect
            value={filter.status ?? ''}
            onChange={(e) => setFilter({ status: e.target.value || null })}
          >
            <option value="">全部状态</option>
            <option value="running">运行中</option>
            <option value="stopped">已停止</option>
            <option value="starting">启动中</option>
            <option value="error">异常</option>
            <option value="unknown">未知</option>
          </StyledSelect>
          <ServerGroupFilter
            groups={uniqueGroups}
            value={groupFilter}
            onChange={setGroupFilter}
          />
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={fetchServers} className="px-3 py-2 border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-slate-900/60 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-slate-800/80 active:scale-95 transition-all duration-150 backdrop-blur-md shadow-sm font-medium">
            刷新
          </button>
          <div className="flex border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-slate-900/60 rounded-lg overflow-hidden backdrop-blur-md shadow-sm">
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-2 text-sm transition-colors font-medium ${viewMode === 'card' ? 'bg-primary-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-slate-800/50'}`}
            >
              卡片
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-sm transition-colors font-medium ${viewMode === 'table' ? 'bg-primary-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-slate-800/50'}`}
            >
              表格
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12 text-gray-400">加载中...</div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchServers} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="还没有服务器配置"
          description="创建一个服务器配置来开始"
          action={{ label: '新建服务器', onClick: () => setCreateOpen(true) }}
        />
      ) : viewMode === 'card' ? (
        <ServerCardGrid
          servers={filtered}
          onEdit={setEditTarget}
          onTerminal={(id) => navigate(`/servers/${id}/terminal`)}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      ) : (
        <ServerTableView
          servers={filtered}
          onEdit={setEditTarget}
          onTerminal={(id) => navigate(`/servers/${id}/terminal`)}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      )}

      {/* Batch Operation Bar */}
      <BatchOperationBar
        selectedCount={selectedIds.size}
        onStart={() => batchAction('start')}
        onStop={() => batchAction('stop')}
        onRestart={() => batchAction('restart')}
        onDelete={() => batchAction('delete')}
        onClear={clearSelection}
        loading={batchLoading}
      />

      {/* Drawers */}
      {createOpen && <CreateServerDrawer onClose={() => setCreateOpen(false)} />}
      {editTarget && <EditServerDrawer server={editTarget} onClose={() => setEditTarget(null)} />}
    </div>
  );
}
