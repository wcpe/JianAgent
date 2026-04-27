import { useNavigate } from 'react-router-dom';
import { Terminal } from 'lucide-react';
import type {
  ResourceActionDto,
  ResourceWorkspaceItemDto,
} from '@jian-agent/shared-domain';
import type { ResourceWorkspaceViewMode } from './resource-workspace.store.js';
import {
  actionLabel,
  formatKind,
  formatState,
  validationBadge,
} from './resource-helpers.js';

interface ResourceListViewProps {
  readonly items: readonly ResourceWorkspaceItemDto[];
  readonly viewMode: ResourceWorkspaceViewMode;
  readonly selectedIds: readonly string[];
  readonly loading: boolean;
  readonly healthByServer?: Readonly<Record<string, string>>;
  readonly tpsByServer?: Readonly<Record<string, number>>;
  readonly onToggleSelected: (id: string) => void;
  readonly onAction: (
    item: ResourceWorkspaceItemDto,
    action: ResourceActionDto,
  ) => void;
}

export function ResourceListView({
  items,
  viewMode,
  selectedIds,
  loading,
  healthByServer,
  tpsByServer,
  onToggleSelected,
  onAction,
}: ResourceListViewProps) {
  const navigate = useNavigate();
  const openDetail = (id: string) => navigate(`/resources/${id}`);

  if (loading) {
    return (
      <section className="rounded-3xl border border-white/60 bg-white/85 p-4 shadow-xl backdrop-blur-xl dark:border-primary-300/20 dark:bg-gray-950/70">
        <div className="flex items-center justify-center py-16 text-sm text-gray-500 dark:text-gray-400">
          加载资源中...
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="rounded-3xl border border-white/60 bg-white/85 p-4 shadow-xl backdrop-blur-xl dark:border-primary-300/20 dark:bg-gray-950/70">
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="rounded-full bg-gray-100 p-4 text-gray-500 dark:bg-gray-800 dark:text-gray-300">
            <Terminal className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              当前没有匹配的资源
            </div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              调整筛选条件，或从统一接入启动器新增资源。
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/60 bg-white/85 p-4 shadow-xl backdrop-blur-xl dark:border-primary-300/20 dark:bg-gray-950/70">
      {viewMode === 'card' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const badge = validationBadge(item.latestValidationSummary);
            return (
              <article
                key={item.summary.id}
                role="button"
                tabIndex={0}
                onClick={() => openDetail(item.summary.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openDetail(item.summary.id);
                  }
                }}
                className="rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-primary-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-primary-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-left text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {item.summary.name}
                    </div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {formatKind(item)}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.summary.id)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => onToggleSelected(item.summary.id)}
                    className="mt-1 rounded"
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {(() => {
                    const health = healthByServer?.[item.summary.id];
                    return health ? (
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        health === 'healthy' ? 'bg-green-500' :
                        health === 'degraded' ? 'bg-yellow-500' :
                        health === 'critical' ? 'bg-red-500' : 'bg-gray-400'
                      }`} title={health} />
                    ) : null;
                  })()}
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {formatState(item)}
                  </span>
                  {(() => {
                    const tps = tpsByServer?.[item.summary.id];
                    return tps != null ? (
                      <span className={`text-xs ${tps < 15 ? 'text-red-600 dark:text-red-400 font-semibold' : tps < 18 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        TPS {tps.toFixed(1)}
                      </span>
                    ) : null;
                  })()}
                  {badge ? (
                    <span className={`rounded-full px-2.5 py-1 text-xs ${badge.className}`}>
                      {badge.label}
                    </span>
                  ) : null}
                  {item.group ? (
                    <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">
                      {item.group}
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 space-y-1 text-sm text-gray-500 dark:text-gray-400">
                  <div>
                    {item.summary.host ?? '-'}
                    {item.summary.port ? `:${item.summary.port}` : ''}
                  </div>
                  {item.description ? <div>{item.description}</div> : null}
                </div>
                {(item.summary.tags ?? []).length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {(item.summary.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                  {(item.availableActions ?? []).slice(0, 4).map((action) => (
                    <button
                      key={action.key}
                      onClick={(event) => {
                        event.stopPropagation();
                        onAction(item, action);
                      }}
                      disabled={!action.enabled}
                      className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      title={action.reason ?? action.label}
                    >
                      {actionLabel(action)}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <th className="px-3 py-3">选择</th>
                <th className="px-3 py-3">名称</th>
                <th className="px-3 py-3">类型</th>
                <th className="px-3 py-3">状态</th>
                <th className="px-3 py-3">健康</th>
                <th className="px-3 py-3">TPS</th>
                <th className="px-3 py-3">地址</th>
                <th className="px-3 py-3">验证</th>
                <th className="px-3 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map((item) => {
                const badge = validationBadge(item.latestValidationSummary);
                return (
                  <tr key={item.summary.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.summary.id)}
                        onChange={() => onToggleSelected(item.summary.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => navigate(`/resources/${item.summary.id}`)}
                        className="font-medium text-gray-900 hover:text-primary-600 dark:text-gray-100 dark:hover:text-primary-300"
                      >
                        {item.summary.name}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-gray-500 dark:text-gray-400">{formatKind(item)}</td>
                    <td className="px-3 py-3 text-gray-500 dark:text-gray-400">{formatState(item)}</td>
                    <td className="px-3 py-3">
                      {(() => {
                        const health = healthByServer?.[item.summary.id];
                        if (!health) return <span className="text-xs text-gray-400">—</span>;
                        const colorMap: Record<string, string> = {
                          healthy: 'text-green-600 dark:text-green-400',
                          degraded: 'text-yellow-600 dark:text-yellow-400',
                          critical: 'text-red-600 dark:text-red-400',
                        };
                        return <span className={`text-xs font-medium ${colorMap[health] ?? 'text-gray-400'}`}>{health}</span>;
                      })()}
                    </td>
                    <td className="px-3 py-3">
                      {(() => {
                        const tps = tpsByServer?.[item.summary.id];
                        if (tps == null) return <span className="text-xs text-gray-400">—</span>;
                        return <span className={`text-xs ${tps < 15 ? 'text-red-600 dark:text-red-400 font-semibold' : tps < 18 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600 dark:text-gray-300'}`}>{tps.toFixed(1)}</span>;
                      })()}
                    </td>
                    <td className="px-3 py-3 text-gray-500 dark:text-gray-400">
                      {item.summary.host ?? '-'}
                      {item.summary.port ? `:${item.summary.port}` : ''}
                    </td>
                    <td className="px-3 py-3">
                      {badge ? (
                        <span className={`rounded-full px-2.5 py-1 text-xs ${badge.className}`}>
                          {badge.label}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">暂无</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        {(item.availableActions ?? []).slice(0, 3).map((action) => (
                          <button
                            key={action.key}
                            onClick={() => onAction(item, action)}
                            disabled={!action.enabled}
                            className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                          >
                            {actionLabel(action)}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
