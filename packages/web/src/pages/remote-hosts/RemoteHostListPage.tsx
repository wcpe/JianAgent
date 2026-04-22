import { useEffect, useState, useCallback } from 'react';
import { remoteHostApi } from '../../api/remote-host.api.js';
import { EmptyState } from '../../components/EmptyState.js';
import { ErrorState } from '../../components/ErrorState.js';
import { StyledSelect } from '../../components/ui/StyledSelect.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import { CreateHostDrawer } from './CreateHostDrawer.js';
import type { RemoteHostDto } from '@jian-agent/shared-domain';

type ViewMode = 'card' | 'table';

export function RemoteHostListPage() {
  const [hosts, setHosts] = useState<readonly RemoteHostDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const fetchHosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await remoteHostApi.list();
      setHosts(data);
    } catch (err: any) {
      setError(err.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHosts();
  }, [fetchHosts]);

  const handleDelete = async (host: RemoteHostDto) => {
    const ok = await useDialogStore.getState().confirm({
      title: '删除远程主机',
      message: `确定删除 "${host.name}"？此操作不可恢复。`,
      variant: 'danger',
      confirmLabel: '删除',
    });
    if (!ok) return;
    try {
      await remoteHostApi.delete(host.id);
      setHosts((prev) => prev.filter((h) => h.id !== host.id));
      useDialogStore.getState().showToast(`已删除 "${host.name}"`, 'success');
    } catch (err: any) {
      useDialogStore.getState().showToast(err.message ?? '删除失败', 'error');
    }
  };

  const handleTest = async (host: RemoteHostDto) => {
    try {
      const res = await remoteHostApi.testConnection(host.id);
      useDialogStore.getState().showToast(
        res.success ? `连接成功: ${res.message}` : `连接失败: ${res.message}`,
        res.success ? 'success' : 'error',
      );
    } catch (err: any) {
      useDialogStore.getState().showToast(err.message ?? '测试失败', 'error');
    }
  };

  const filtered = hosts.filter((h) => {
    if (search && !h.name.toLowerCase().includes(search.toLowerCase()) && !h.host.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && h.status !== statusFilter) return false;
    return true;
  });

  const statusLabel = (s: string) => {
    switch (s) {
      case 'online': return '在线';
      case 'offline': return '离线';
      case 'error': return '异常';
      default: return '未知';
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'online': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'offline': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
      case 'error': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    }
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">远程主机</h1>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg p-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCreateOpen(true)}
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 active:scale-95 transition-all duration-150"
          >
            新建主机
          </button>
          <input
            placeholder="搜索名称或地址..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm w-40 md:w-48"
          />
          <StyledSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">全部状态</option>
            <option value="online">在线</option>
            <option value="offline">离线</option>
            <option value="error">异常</option>
            <option value="unknown">未知</option>
          </StyledSelect>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchHosts}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 active:scale-95 transition-all duration-150"
          >
            刷新
          </button>
          <div className="flex border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-2 text-sm ${viewMode === 'card' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
            >
              卡片
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-sm ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
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
        <ErrorState message={error} onRetry={fetchHosts} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="还没有远程主机"
          description="添加远程主机来统一管理"
          action={{ label: '新建主机', onClick: () => setCreateOpen(true) }}
        />
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((host) => (
            <div
              key={host.id}
              className="rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{host.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(host.status)}`}>
                  {statusLabel(host.status)}
                </span>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {host.username}@{host.host}:{host.port}
              </div>
              {host.description && (
                <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{host.description}</div>
              )}
              {host.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {host.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => handleTest(host)}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >
                  测试连接
                </button>
                <button
                  onClick={() => handleDelete(host)}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/55 dark:border-primary-300/20 backdrop-blur-xl bg-white/80 dark:bg-slate-900/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/40 dark:border-primary-300/10 bg-white/40 dark:bg-slate-800/40 text-left text-xs text-gray-600 dark:text-gray-300 uppercase whitespace-nowrap font-semibold">
                <th className="px-4 py-3">名称</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">地址</th>
                <th className="px-4 py-3">认证方式</th>
                <th className="px-4 py-3">标签</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/30 dark:divide-primary-300/10">
              {filtered.map((host) => (
                <tr
                  key={host.id}
                  className={`transition-colors ${
                    host.id.charCodeAt(0) % 2 === 0
                      ? 'hover:bg-white/50 dark:hover:bg-slate-800/50'
                      : 'bg-white/20 dark:bg-slate-800/10 hover:bg-white/60 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{host.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(host.status)}`}>
                      {statusLabel(host.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {host.username}@{host.host}:{host.port}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {host.authType === 'password' ? '密码' : '密钥'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {host.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTest(host)}
                        className="text-primary-600 dark:text-primary-400 hover:underline text-xs"
                      >
                        测试
                      </button>
                      <button
                        onClick={() => handleDelete(host)}
                        className="text-red-600 dark:text-red-400 hover:underline text-xs"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawers */}
      {createOpen && (
        <CreateHostDrawer
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            fetchHosts();
          }}
        />
      )}
    </div>
  );
}
