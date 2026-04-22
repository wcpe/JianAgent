import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  ResourceActionDto,
  ResourceValidationSummaryDto,
  ResourceWorkspaceItemDto,
  ServerType,
} from '@jian-agent/shared-domain';
import {
  Globe,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { remoteHostApi } from '../../api/remote-host.api.js';
import { serverApi } from '../../api/server.api.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import { CreateHostDrawer } from '../../pages/remote-hosts/CreateHostDrawer.js';
import { CreateServerDrawer } from '../../pages/servers/CreateServerDrawer.js';
import {
  useResourceWorkspaceStore,
  type ResourceWorkspaceFilters,
} from './resource-workspace.store.js';

type LauncherMode =
  | null
  | 'launcher'
  | 'managed-existing'
  | 'managed-paper'
  | 'external-server'
  | 'remote-host';

interface ResourceWorkspacePageProps {
  readonly initialFilters?: ResourceWorkspaceFilters;
  readonly title?: string;
  readonly subtitle?: string;
}

function formatKind(item: ResourceWorkspaceItemDto): string {
  if (item.summary.kind === 'REMOTE_HOST') {
    return '远程主机';
  }
  if (item.serverType === 'external') {
    return '外置服务器';
  }
  return '托管服务器';
}

function formatState(item: ResourceWorkspaceItemDto): string {
  const labels: Record<string, string> = {
    running: '运行中',
    stopped: '已停止',
    starting: '启动中',
    stopping: '停止中',
    error: '异常',
    unknown: '未知',
    online: '在线',
  };
  return labels[item.summary.status] ?? item.summary.status;
}

function validationBadge(
  summary: ResourceValidationSummaryDto | null,
): { label: string; className: string } | null {
  if (!summary) {
    return null;
  }

  switch (summary.verdict) {
    case 'passed':
      return {
        label: '最近验证通过',
        className:
          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      };
    case 'failed':
      return {
        label: '最近验证失败',
        className:
          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      };
    case 'running':
      return {
        label: '验证进行中',
        className:
          'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      };
    case 'cancelled':
      return {
        label: '验证已取消',
        className:
          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      };
    default:
      return {
        label: '验证状态未知',
        className:
          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      };
  }
}

function actionLabel(action: ResourceActionDto): string {
  if (action.key === 'validation') {
    return '验证';
  }
  return action.label;
}

function ResourceOnboardingLauncher({
  onClose,
  onSelect,
}: {
  readonly onClose: () => void;
  readonly onSelect: (mode: Exclude<LauncherMode, null>) => void;
}) {
  const options: Array<{
    mode: Exclude<LauncherMode, null>;
    title: string;
    description: string;
    icon: typeof Server;
  }> = [
    {
      mode: 'managed-existing',
      title: '托管服务器 / 纳管现有目录',
      description: '接管已经准备好的本地服务器目录。',
      icon: Server,
    },
    {
      mode: 'managed-paper',
      title: '托管服务器 / 初始化新 Paper 工作区',
      description: '创建新的托管服务器配置并准备 Paper 工作区。',
      icon: Server,
    },
    {
      mode: 'external-server',
      title: '外置服务器 / 纳管运行中地址',
      description: '以地址和端口纳管已运行的 Minecraft 服务器。',
      icon: ShieldCheck,
    },
    {
      mode: 'remote-host',
      title: '远程主机 / SSH 接入',
      description: '通过 SSH 接入远程主机，纳入统一资源工作台。',
      icon: Globe,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-4xl rounded-3xl border border-white/60 bg-white/90 p-6 shadow-2xl backdrop-blur-xl dark:border-primary-300/20 dark:bg-slate-950/90">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Resource Onboarding
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              选择资源接入路径
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            关闭
          </button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {options.map((option) => (
            <button
              key={option.mode}
              onClick={() => onSelect(option.mode)}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-primary-50 p-3 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
                  <option.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {option.title}
                  </div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {option.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
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

  const [launcherMode, setLauncherMode] = useState<LauncherMode>(null);

  useEffect(() => {
    if (initialFilters) {
      replaceFilters(initialFilters);
      return;
    }
    replaceFilters({});
  }, [initialFilters, replaceFilters]);

  useEffect(() => {
    void load();
  }, [filters, load]);

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
        case 'delete':
          if (item.summary.kind === 'REMOTE_HOST') {
            await remoteHostApi.delete(item.summary.id);
          } else {
            await serverApi.deleteServer(item.summary.id);
          }
          break;
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
      await serverApi.batchOperation(action, selectedServerIds);
      clearSelection();
      await load();
    } catch (err: any) {
      useDialogStore
        .getState()
        .showToast(err.message ?? `批量${action}失败`, 'error');
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6" data-testid="resource-workspace-page">
      <section className="rounded-3xl border border-white/60 bg-white/85 p-6 shadow-xl backdrop-blur-xl dark:border-primary-300/20 dark:bg-slate-950/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Integrated Resources
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setLauncherMode('launcher')}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-primary-600/20 hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              接入资源
            </button>
            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">资源总数</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{summary.total}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">服务器</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{summary.byKind.SERVER ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">远程主机</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{summary.byKind.REMOTE_HOST ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">当前可见</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{total}</div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/60 bg-white/85 p-4 shadow-xl backdrop-blur-xl dark:border-primary-300/20 dark:bg-slate-950/70">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-wrap gap-2">
            <label className="relative min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={filters.q ?? ''}
                onChange={(event) => setFilters({ q: event.target.value || undefined })}
                placeholder="搜索名称、地址、标签、描述..."
                className="w-full rounded-2xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-primary-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <select
              value={filters.kind ?? ''}
              onChange={(event) =>
                setFilters({
                  kind: (event.target.value || undefined) as
                    | 'SERVER'
                    | 'REMOTE_HOST'
                    | undefined,
                  serverType:
                    event.target.value === 'REMOTE_HOST'
                      ? undefined
                      : filters.serverType,
                })
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="">全部资源</option>
              <option value="SERVER">服务器</option>
              <option value="REMOTE_HOST">远程主机</option>
            </select>
            <select
              value={filters.serverType ?? ''}
              onChange={(event) =>
                setFilters({
                  serverType: (event.target.value || undefined) as
                    | ServerType
                    | undefined,
                })
              }
              disabled={filters.kind === 'REMOTE_HOST'}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="">全部服务器类型</option>
              <option value="managed">托管服务器</option>
              <option value="external">外置服务器</option>
            </select>
            <select
              value={filters.status ?? ''}
              onChange={(event) =>
                setFilters({ status: event.target.value || undefined })
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="">全部状态</option>
              <option value="running">运行中</option>
              <option value="stopped">已停止</option>
              <option value="starting">启动中</option>
              <option value="unknown">未知</option>
              <option value="error">异常</option>
            </select>
            <input
              value={filters.group ?? ''}
              onChange={(event) => setFilters({ group: event.target.value || undefined })}
              placeholder="分组"
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            <input
              value={filters.tag ?? ''}
              onChange={(event) => setFilters({ tag: event.target.value || undefined })}
              placeholder="标签"
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-2xl border border-slate-200 p-1 dark:border-slate-700">
              <button
                onClick={() => setViewMode('card')}
                className={`rounded-xl p-2 ${viewMode === 'card' ? 'bg-primary-600 text-white' : 'text-slate-500 dark:text-slate-300'}`}
                aria-label="卡片视图"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`rounded-xl p-2 ${viewMode === 'table' ? 'bg-primary-600 text-white' : 'text-slate-500 dark:text-slate-300'}`}
                aria-label="表格视图"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {selectedServerIds.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800 dark:border-primary-900/40 dark:bg-primary-900/20 dark:text-primary-200">
            <span>已选择 {selectedServerIds.length} 台服务器</span>
            <button onClick={() => void handleBatchAction('start')} className="rounded-xl bg-white px-3 py-1.5 text-xs shadow-sm dark:bg-slate-900">
              批量启动
            </button>
            <button onClick={() => void handleBatchAction('stop')} className="rounded-xl bg-white px-3 py-1.5 text-xs shadow-sm dark:bg-slate-900">
              批量停止
            </button>
            <button onClick={() => void handleBatchAction('restart')} className="rounded-xl bg-white px-3 py-1.5 text-xs shadow-sm dark:bg-slate-900">
              批量重启
            </button>
            <button onClick={() => void handleBatchAction('delete')} className="rounded-xl bg-white px-3 py-1.5 text-xs shadow-sm dark:bg-slate-900">
              批量删除
            </button>
            <button onClick={clearSelection} className="ml-auto text-xs text-primary-700 underline dark:text-primary-300">
              清空选择
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-white/60 bg-white/85 p-4 shadow-xl backdrop-blur-xl dark:border-primary-300/20 dark:bg-slate-950/70">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-500 dark:text-slate-400">
            加载资源中...
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="rounded-full bg-slate-100 p-4 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <Terminal className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                当前没有匹配的资源
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                调整筛选条件，或从统一接入启动器新增资源。
              </div>
            </div>
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const badge = validationBadge(item.latestValidationSummary);
              return (
                <article
                  key={item.summary.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <button
                        onClick={() => navigate(`/resources/${item.summary.id}`)}
                        className="text-left text-lg font-semibold text-slate-900 hover:text-primary-600 dark:text-slate-100 dark:hover:text-primary-300"
                      >
                        {item.summary.name}
                      </button>
                      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {formatKind(item)}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.summary.id)}
                      onChange={() => toggleSelected(item.summary.id)}
                      className="mt-1 rounded"
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {formatState(item)}
                    </span>
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
                  <div className="mt-4 space-y-1 text-sm text-slate-500 dark:text-slate-400">
                    <div>
                      {item.summary.host ?? '-'}
                      {item.summary.port ? `:${item.summary.port}` : ''}
                    </div>
                    {item.description ? <div>{item.description}</div> : null}
                  </div>
                  {item.summary.tags.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {item.summary.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                    {item.availableActions.slice(0, 4).map((action) => (
                      <button
                        key={action.key}
                        onClick={() => void handleAction(item, action)}
                        disabled={!action.enabled}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-3 py-3">选择</th>
                  <th className="px-3 py-3">名称</th>
                  <th className="px-3 py-3">类型</th>
                  <th className="px-3 py-3">状态</th>
                  <th className="px-3 py-3">地址</th>
                  <th className="px-3 py-3">验证</th>
                  <th className="px-3 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item) => {
                  const badge = validationBadge(item.latestValidationSummary);
                  return (
                    <tr key={item.summary.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.summary.id)}
                          onChange={() => toggleSelected(item.summary.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => navigate(`/resources/${item.summary.id}`)}
                          className="font-medium text-slate-900 hover:text-primary-600 dark:text-slate-100 dark:hover:text-primary-300"
                        >
                          {item.summary.name}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-slate-500 dark:text-slate-400">{formatKind(item)}</td>
                      <td className="px-3 py-3 text-slate-500 dark:text-slate-400">{formatState(item)}</td>
                      <td className="px-3 py-3 text-slate-500 dark:text-slate-400">
                        {item.summary.host ?? '-'}
                        {item.summary.port ? `:${item.summary.port}` : ''}
                      </td>
                      <td className="px-3 py-3">
                        {badge ? (
                          <span className={`rounded-full px-2.5 py-1 text-xs ${badge.className}`}>
                            {badge.label}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">暂无</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {item.availableActions.slice(0, 3).map((action) => (
                            <button
                              key={action.key}
                              onClick={() => void handleAction(item, action)}
                              disabled={!action.enabled}
                              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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

      {launcherMode === 'launcher' ? (
        <ResourceOnboardingLauncher
          onClose={() => setLauncherMode(null)}
          onSelect={(mode) => setLauncherMode(mode)}
        />
      ) : null}

      {launcherMode === 'managed-existing' ? (
        <CreateServerDrawer
          onClose={() => {
            setLauncherMode(null);
            void load();
          }}
          initialServerType="managed"
          title="纳管现有托管服务器目录"
        />
      ) : null}

      {launcherMode === 'managed-paper' ? (
        <CreateServerDrawer
          onClose={() => {
            setLauncherMode(null);
            void load();
          }}
          initialServerType="managed"
          title="初始化新的 Paper 托管服务器"
        />
      ) : null}

      {launcherMode === 'external-server' ? (
        <CreateServerDrawer
          onClose={() => {
            setLauncherMode(null);
            void load();
          }}
          initialServerType="external"
          title="纳管运行中的外置服务器"
        />
      ) : null}

      {launcherMode === 'remote-host' ? (
        <CreateHostDrawer
          onClose={() => setLauncherMode(null)}
          onCreated={() => {
            setLauncherMode(null);
            void load();
          }}
          title="通过 SSH 接入远程主机"
        />
      ) : null}
    </div>
  );
}
