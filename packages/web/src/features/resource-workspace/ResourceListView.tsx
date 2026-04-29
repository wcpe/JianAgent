import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Terminal, Puzzle, FileText } from 'lucide-react';
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
import { ResourceActionMenu } from './components/ResourceActionMenu';

interface ResourceListViewProps {
  readonly items: readonly ResourceWorkspaceItemDto[];
  readonly viewMode: ResourceWorkspaceViewMode;
  readonly selectedIds: readonly string[];
  readonly loading: boolean;
  readonly healthByServer?: Readonly<Record<string, string>>;
  readonly tpsByServer?: Readonly<Record<string, number>>;
  readonly metricsByServer?: Readonly<Record<string, any>>;
  readonly lastMetricsAt?: Readonly<Record<string, number>>;
  readonly onToggleSelected: (id: string) => void;
  readonly onAction: (
    item: ResourceWorkspaceItemDto,
    action: ResourceActionDto,
  ) => void;
}

/**
 * 根据资源状态选择主要动作
 * 优先级规则：
 * - running: stop, restart, terminal
 * - stopped: start, delete, terminal
 * - starting: interrupt, terminal
 * - error: restart, delete, terminal
 */
function pickPrimaryActions(
  actions: readonly ResourceActionDto[],
  status: string,
): readonly ResourceActionDto[] {
  const priorityMap: Record<string, string[]> = {
    running: ['stop', 'restart', 'terminal'],
    stopped: ['start', 'delete', 'terminal'],
    starting: ['interrupt', 'terminal'],
    error: ['restart', 'delete', 'terminal'],
  };

  const priorities = priorityMap[status] ?? ['start', 'stop', 'restart'];
  const sorted = [...actions].sort((a, b) => {
    const aIndex = priorities.indexOf(a.key);
    const bIndex = priorities.indexOf(b.key);
    const aPriority = aIndex === -1 ? 999 : aIndex;
    const bPriority = bIndex === -1 ? 999 : bIndex;
    return aPriority - bPriority;
  });

  return sorted.slice(0, 3);
}

export function ResourceListView({
  items,
  viewMode,
  selectedIds,
  loading,
  healthByServer,
  tpsByServer,
  metricsByServer,
  lastMetricsAt,
  onToggleSelected,
  onAction,
}: ResourceListViewProps) {
  const navigate = useNavigate();
  const openDetail = (id: string) => navigate(`/resources/${id}`);
  
  // 强制每秒重新渲染以更新过期状态（仅当有 lastMetricsAt 数据时）
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!lastMetricsAt || Object.keys(lastMetricsAt).length === 0) {
      return;
    }
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastMetricsAt]);

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
                className={`rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md ${
                  item.summary.status === 'running'
                    ? 'border-green-400 bg-white hover:border-green-500 dark:border-green-600 dark:bg-gray-900 dark:hover:border-green-500'
                    : 'border-gray-200 bg-white hover:border-primary-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-primary-700'
                }`}
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
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    item.summary.status === 'running'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
                  }`}>
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
                {(() => {
                  const metrics = metricsByServer?.[item.summary.id];
                  if (!metrics || item.summary.status !== 'running') return null;
                  const usedMemoryMb = Number(metrics.usedMemoryMb ?? 0);
                  const maxMemoryMb = Number(metrics.maxMemoryMb ?? 0);
                  const lastUpdate = lastMetricsAt?.[item.summary.id];
                  const now = Date.now();
                  const isStale = lastUpdate != null && (now - lastUpdate > 15000);
                  return (
                    <div className="mt-4 space-y-2">
                      {isStale && (
                        <div className="flex items-center gap-1.5 rounded-lg bg-yellow-50 px-2.5 py-1.5 text-xs text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          数据可能过期
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                        <div className="space-y-1">
                          <div className="text-xs text-gray-500 dark:text-gray-400">在线玩家</div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {metrics.onlinePlayers}/{metrics.maxPlayers}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-gray-500 dark:text-gray-400">TPS</div>
                          <div className={`text-sm font-semibold ${
                            metrics.tps < 15 ? 'text-red-600 dark:text-red-400' :
                            metrics.tps < 18 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-green-600 dark:text-green-400'
                          }`}>
                            {metrics.tps.toFixed(1)}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-gray-500 dark:text-gray-400">内存</div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {usedMemoryMb.toFixed(0)}MB / {maxMemoryMb.toFixed(0)}MB
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-gray-500 dark:text-gray-400">CPU</div>
                          <div className={`text-sm font-semibold ${
                            metrics.cpuUsage > 80 ? 'text-red-600 dark:text-red-400' :
                            metrics.cpuUsage > 60 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-green-600 dark:text-green-400'
                          }`}>
                            {metrics.cpuUsage.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
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
                  {(() => {
                    const allActions = item.availableActions ?? [];
                    const primaryActions = pickPrimaryActions(allActions, item.summary.status);
                    const remainingActions = allActions.filter(
                      (action) => !primaryActions.some((pa) => pa.key === action.key)
                    );

                    return (
                      <>
                        {primaryActions.map((action) => (
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
                        {remainingActions.length > 0 && (
                          <div onClick={(event) => event.stopPropagation()}>
                            <ResourceActionMenu
                              actions={remainingActions.map((action) => ({
                                id: action.key,
                                label: actionLabel(action),
                                icon: '',
                                disabled: !action.enabled,
                              }))}
                              onAction={(actionId) => {
                                const action = remainingActions.find((a) => a.key === actionId);
                                if (action) onAction(item, action);
                              }}
                            />
                          </div>
                        )}
                        {item.summary.kind === 'SERVER' && (
                          <>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(`/resources/${item.summary.id}/plugins`);
                              }}
                              className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs text-primary-700 hover:bg-primary-100 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/50"
                              title="插件管理"
                            >
                              <Puzzle className="inline h-3 w-3 mr-1" />
                              插件
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(`/resources/${item.summary.id}/logs`);
                              }}
                              className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs text-primary-700 hover:bg-primary-100 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/50"
                              title="日志查看"
                            >
                              <FileText className="inline h-3 w-3 mr-1" />
                              日志
                            </button>
                          </>
                        )}
                      </>
                    );
                  })()}
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
                        {(() => {
                          const allActions = item.availableActions ?? [];
                          const primaryActions = pickPrimaryActions(allActions, item.summary.status);
                          const remainingActions = allActions.filter(
                            (action) => !primaryActions.some((pa) => pa.key === action.key)
                          );

                          return (
                            <>
                              {primaryActions.map((action) => (
                                <button
                                  key={action.key}
                                  onClick={() => onAction(item, action)}
                                  disabled={!action.enabled}
                                  className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                  {actionLabel(action)}
                                </button>
                              ))}
                              {remainingActions.length > 0 && (
                                <ResourceActionMenu
                                  actions={remainingActions.map((action) => ({
                                    id: action.key,
                                    label: actionLabel(action),
                                    icon: '',
                                    disabled: !action.enabled,
                                  }))}
                                  onAction={(actionId) => {
                                    const action = remainingActions.find((a) => a.key === actionId);
                                    if (action) onAction(item, action);
                                  }}
                                />
                              )}
                            </>
                          );
                        })()}
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
