import { Plus, RefreshCw } from 'lucide-react';
import type { ResourceWorkspaceSummaryDto } from '@jian-agent/shared-domain';

interface ResourceSummaryHeaderProps {
  readonly title: string;
  readonly subtitle: string;
  readonly summary: ResourceWorkspaceSummaryDto;
  readonly total: number;
  readonly onAddResource: () => void;
  readonly onRefresh: () => void;
}

export function ResourceSummaryHeader({
  title,
  subtitle,
  summary,
  total,
  onAddResource,
  onRefresh,
}: ResourceSummaryHeaderProps) {
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
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400">资源总数</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.total}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400">服务器</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.byKind.SERVER ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400">远程主机</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.byKind.REMOTE_HOST ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400">当前可见</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{total}</div>
        </div>
      </div>
    </section>
  );
}
