import { useState, useEffect } from 'react';
import { LayoutGrid, List, Search } from 'lucide-react';
import { ErrorAlert } from '../../components/ui/ErrorAlert.js';
import type { ServerType } from '@jian-agent/shared-domain';
import { useDebounce } from '../../hooks/useDebounce.js';
import type {
  ResourceWorkspaceFilters,
  ResourceWorkspaceViewMode,
} from './resource-workspace.store.js';

interface ResourceFilterBarProps {
  readonly filters: ResourceWorkspaceFilters;
  readonly viewMode: ResourceWorkspaceViewMode;
  readonly selectedServerCount: number;
  readonly error: string | null;
  readonly onSetFilters: (patch: Partial<ResourceWorkspaceFilters>) => void;
  readonly onSetViewMode: (mode: ResourceWorkspaceViewMode) => void;
  readonly onBatchAction: (action: 'start' | 'stop' | 'restart' | 'delete') => void;
  readonly onClearSelection: () => void;
}

export function ResourceFilterBar({
  filters,
  viewMode,
  selectedServerCount,
  error,
  onSetFilters,
  onSetViewMode,
  onBatchAction,
  onClearSelection,
}: ResourceFilterBarProps) {
  // 本地状态用于即时更新 UI
  const [localQ, setLocalQ] = useState(filters.q ?? '');
  const [localGroup, setLocalGroup] = useState(filters.group ?? '');
  const [localTag, setLocalTag] = useState(filters.tag ?? '');

  // 防抖后的值
  const debouncedQ = useDebounce(localQ, 400);
  const debouncedGroup = useDebounce(localGroup, 400);
  const debouncedTag = useDebounce(localTag, 400);

  // 当防抖后的值变化时，触发外部更新
  useEffect(() => {
    if (debouncedQ !== (filters.q ?? '')) {
      onSetFilters({ q: debouncedQ || undefined });
    }
  }, [debouncedQ]);

  useEffect(() => {
    if (debouncedGroup !== (filters.group ?? '')) {
      onSetFilters({ group: debouncedGroup || undefined });
    }
  }, [debouncedGroup]);

  useEffect(() => {
    if (debouncedTag !== (filters.tag ?? '')) {
      onSetFilters({ tag: debouncedTag || undefined });
    }
  }, [debouncedTag]);

  // 当外部 filters 变化时，同步到本地状态（避免循环）
  useEffect(() => {
    setLocalQ(filters.q ?? '');
  }, [filters.q]);

  useEffect(() => {
    setLocalGroup(filters.group ?? '');
  }, [filters.group]);

  useEffect(() => {
    setLocalTag(filters.tag ?? '');
  }, [filters.tag]);

  return (
    <section className="rounded-3xl border border-white/60 bg-white/85 p-4 shadow-xl backdrop-blur-xl dark:border-primary-300/20 dark:bg-gray-950/70">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <label className="relative min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={localQ}
              onChange={(event) => setLocalQ(event.target.value)}
              placeholder="搜索名称、地址、标签、描述..."
              className="w-full rounded-2xl border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
          <select
            value={filters.kind ?? ''}
            onChange={(event) =>
              onSetFilters({
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
            className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="">全部资源</option>
            <option value="SERVER">服务器</option>
            <option value="REMOTE_HOST">远程主机</option>
          </select>
          <select
            value={filters.serverType ?? ''}
            onChange={(event) =>
              onSetFilters({
                serverType: (event.target.value || undefined) as
                  | ServerType
                  | undefined,
              })
            }
            disabled={filters.kind === 'REMOTE_HOST'}
            className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="">全部服务器类型</option>
            <option value="managed">托管服务器</option>
            <option value="external">外置服务器</option>
          </select>
          <select
            value={filters.status ?? ''}
            onChange={(event) =>
              onSetFilters({ status: event.target.value || undefined })
            }
            className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="">全部状态</option>
            <option value="running">运行中</option>
            <option value="stopped">已停止</option>
            <option value="starting">启动中</option>
            <option value="unknown">未知</option>
            <option value="error">异常</option>
          </select>
          <input
            value={localGroup}
            onChange={(event) => setLocalGroup(event.target.value)}
            placeholder="分组"
            className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          />
          <input
            value={localTag}
            onChange={(event) => setLocalTag(event.target.value)}
            placeholder="标签"
            className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-2xl border border-gray-200 p-1 dark:border-gray-700">
            <button
              onClick={() => onSetViewMode('card')}
              className={`rounded-xl p-2 ${viewMode === 'card' ? 'bg-primary-600 text-white' : 'text-gray-500 dark:text-gray-300'}`}
              aria-label="卡片视图"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => onSetViewMode('table')}
              className={`rounded-xl p-2 ${viewMode === 'table' ? 'bg-primary-600 text-white' : 'text-gray-500 dark:text-gray-300'}`}
              aria-label="表格视图"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {selectedServerCount > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800 dark:border-primary-900/40 dark:bg-primary-900/20 dark:text-primary-200">
          <span>已选择 {selectedServerCount} 台服务器</span>
          <button onClick={() => onBatchAction('start')} className="rounded-xl bg-white px-3 py-1.5 text-xs shadow-sm dark:bg-gray-900">
            批量启动
          </button>
          <button onClick={() => onBatchAction('stop')} className="rounded-xl bg-white px-3 py-1.5 text-xs shadow-sm dark:bg-gray-900">
            批量停止
          </button>
          <button onClick={() => onBatchAction('restart')} className="rounded-xl bg-white px-3 py-1.5 text-xs shadow-sm dark:bg-gray-900">
            批量重启
          </button>
          <button onClick={() => onBatchAction('delete')} className="rounded-xl bg-white px-3 py-1.5 text-xs shadow-sm dark:bg-gray-900">
            批量删除
          </button>
          <button onClick={onClearSelection} className="ml-auto text-xs text-primary-700 underline dark:text-primary-300">
            清空选择
          </button>
        </div>
      ) : null}

      {error ? <ErrorAlert message={error} className="mt-4" /> : null}
    </section>
  );
}
