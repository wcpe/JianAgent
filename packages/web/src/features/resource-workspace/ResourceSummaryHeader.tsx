import { Plus, RefreshCw } from 'lucide-react';
import type { ResourceWorkspaceSummaryDto } from '@jian-agent/shared-domain';

interface ResourceSummaryHeaderProps {
  readonly title: string;
  readonly subtitle: string;
  readonly summary: ResourceWorkspaceSummaryDto;
  readonly total: number;
  readonly page?: number;
  readonly limit?: number;
  readonly currentStatus?: string;
  readonly onAddResource: () => void;
  readonly onRefresh: () => void;
  readonly onQuickFilter: (status: string | undefined) => void;
}

export function ResourceSummaryHeader({
  title,
  subtitle,
  summary,
  total,
  page = 1,
  limit = 20,
  currentStatus,
  onAddResource,
  onRefresh,
  onQuickFilter,
}: ResourceSummaryHeaderProps) {
  // 计算当前可见区间
  const startIndex = total === 0 ? 0 : (page - 1) * limit + 1;
  const endIndex = Math.min(page * limit, total);
  const rangeText = total === 0 ? '暂无数据' : `显示 ${startIndex}-${endIndex} / 共 ${total} 项`;

  return (
    <section className="rounded-3xl border border-white/60 bg-white/85 p-6 shadow-xl backdrop-blur-xl dark:border-primary-300/20 dark:bg-gray-950/70">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
            Integrated Resources
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
            {subtitle}
          </p>
          <p className="mt-2 text-xs font-medium text-primary-600 dark:text-primary-400">
            {rangeText}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onAddResource}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-primary-600/20 hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            接入资源
          </button>
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <button
          onClick={() => onQuickFilter(undefined)}
          className={`rounded-2xl border px-4 py-3 shadow-sm text-left transition-all duration-200 ${
            currentStatus === undefined
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-200 bg-white hover:border-primary-300 cursor-pointer dark:border-gray-800 dark:bg-gray-900'
          }`}
        >
          <div className="text-xs text-gray-500 dark:text-gray-400">资源总数</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.total}</div>
        </button>
        <button
          onClick={() => onQuickFilter('running')}
          className={`rounded-2xl border px-4 py-3 shadow-sm text-left transition-all duration-200 ${
            currentStatus === 'running'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-200 bg-white hover:border-primary-300 cursor-pointer dark:border-gray-800 dark:bg-gray-900'
          }`}
        >
          <div className="text-xs text-gray-500 dark:text-gray-400">运行中</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.byStatus.running ?? 0}</div>
        </button>
        <button
          onClick={() => onQuickFilter('stopped')}
          className={`rounded-2xl border px-4 py-3 shadow-sm text-left transition-all duration-200 ${
            currentStatus === 'stopped'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-200 bg-white hover:border-primary-300 cursor-pointer dark:border-gray-800 dark:bg-gray-900'
          }`}
        >
          <div className="text-xs text-gray-500 dark:text-gray-400">已停止</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.byStatus.stopped ?? 0}</div>
        </button>
        <button
          onClick={() => onQuickFilter('error')}
          className={`rounded-2xl border px-4 py-3 shadow-sm text-left transition-all duration-200 ${
            currentStatus === 'error'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-200 bg-white hover:border-primary-300 cursor-pointer dark:border-gray-800 dark:bg-gray-900'
          }`}
        >
          <div className="text-xs text-gray-500 dark:text-gray-400">异常</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.byStatus.error ?? 0}</div>
        </button>
      </div>
    </section>
  );
}
