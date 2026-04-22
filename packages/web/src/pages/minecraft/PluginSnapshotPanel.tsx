import { useState } from 'react';
import type { ProbeSnapshotDto, PluginDetailDto } from '@jian-agent/shared-domain';

interface PluginSnapshotPanelProps {
  serverId: string;
  snapshot: ProbeSnapshotDto | null;
  connected: boolean;
}

export function PluginSnapshotPanel({ serverId: _serverId, snapshot, connected }: PluginSnapshotPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');

  const plugins = snapshot?.plugins ?? [];

  const filteredPlugins = plugins.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'enabled' && p.enabled) ||
      (statusFilter === 'disabled' && !p.enabled);
    return matchesSearch && matchesStatus;
  });

  const enabledCount = plugins.filter((p) => p.enabled).length;
  const disabledCount = plugins.length - enabledCount;

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800/50">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">
          插件快照
          {plugins.length > 0 && (
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
              ({plugins.length} 个插件)
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="搜索插件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 w-40"
          />
        </div>
      </div>

      {/* Filter Pills */}
      {plugins.length > 0 && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            全部 ({plugins.length})
          </button>
          <button
            onClick={() => setStatusFilter('enabled')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              statusFilter === 'enabled'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            启用 ({enabledCount})
          </button>
          <button
            onClick={() => setStatusFilter('disabled')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              statusFilter === 'disabled'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            禁用 ({disabledCount})
          </button>
        </div>
      )}

      {!connected && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
          探针未连接，无法获取插件数据
        </p>
      )}

      {connected && plugins.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
          未检测到插件
        </p>
      )}

      {connected && plugins.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPlugins.map((plugin) => (
            <PluginCard key={plugin.name} plugin={plugin} />
          ))}
          {filteredPlugins.length === 0 && (
            <div className="col-span-full text-sm text-gray-400 dark:text-gray-500 text-center py-4">
              无匹配插件
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PluginCard({ plugin }: { plugin: PluginDetailDto }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
          {plugin.name}
        </span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
            plugin.enabled
              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
          }`}
        >
          {plugin.enabled ? '启用' : '禁用'}
        </span>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
        <div>版本: <span className="font-mono">{plugin.version}</span></div>
        {plugin.authors.length > 0 && (
          <div className="truncate">作者: {plugin.authors.join(', ')}</div>
        )}
      </div>
    </div>
  );
}
