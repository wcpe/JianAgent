import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  LocalValidationRunDto,
  ResourceDetailDto,
} from '@jian-agent/shared-domain';
import { localValidationApi } from '../../api/local-validation.api.js';

interface ValidationOpsTabProps {
  readonly detail: ResourceDetailDto;
}

function formatRunStatus(status: LocalValidationRunDto['status']): string {
  const labels: Record<LocalValidationRunDto['status'], string> = {
    CREATED: '待启动',
    PRECHECKING: '预检中',
    PROVISIONING: '准备环境',
    STARTING: '启动中',
    READY: '已就绪',
    RUNNING_SCENARIO: '场景执行中',
    PASSED: '通过',
    FAILED_PRECHECK: '预检失败',
    FAILED_PROVISION: '准备失败',
    FAILED_STARTUP: '启动失败',
    FAILED_SCENARIO: '场景失败',
    FAILED_RUNTIME: '运行时失败',
    CANCELLED: '已取消',
    CLEANING: '清理中',
    FINISHED: '已完成',
  };

  return labels[status];
}

function formatTime(value?: string | null): string {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ValidationOpsTab({ detail }: ValidationOpsTabProps) {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<LocalValidationRunDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (detail.kind !== 'SERVER') {
      setRuns([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    void localValidationApi
      .listRuns()
      .then((result) => {
        setRuns(
          result
            .filter((run) => run.serverId === detail.id)
            .slice(0, 8),
        );
      })
      .catch((err: any) => {
        setError(err.message ?? '加载验证运行失败');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [detail.id, detail.kind]);

  const latestRun = useMemo(
    () => runs[0] ?? null,
    [runs],
  );

  if (detail.kind !== 'SERVER') {
    return (
      <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
        当前资源类型不支持本地服务器验证。
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-3xl border border-white/60 bg-white/85 p-5 shadow-xl backdrop-blur-xl dark:border-primary-300/20 dark:bg-slate-950/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Validation
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
              验证与治理
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              展示该服务器最近一次本地验证结论，并提供进入本地验证运行台的统一入口。
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/local-validation?serverId=${encodeURIComponent(detail.id)}`)}
              className="rounded-2xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              打开本地验证运行台
            </button>
            <button
              onClick={() => navigate(`/resources/${detail.id}`)}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              返回概览
            </button>
          </div>
        </div>
      </div>

      {detail.latestValidationSummary ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            最近结论
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">状态</div>
              <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                {detail.latestValidationSummary.state}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">结论</div>
              <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                {detail.latestValidationSummary.verdict}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">完成时间</div>
              <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                {formatTime(detail.latestValidationSummary.finishedAt)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">运行 ID</div>
              <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                {detail.latestValidationSummary.runId}
              </div>
            </div>
          </div>
          {detail.latestValidationSummary.failureReason ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {detail.latestValidationSummary.failureReason}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            最近运行
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            共 {runs.length} 条
          </div>
        </div>
        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            加载中...
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-rose-600 dark:text-rose-300">
            {error}
          </div>
        ) : runs.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            当前服务器还没有关联的本地验证运行。
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {(latestRun ? runs : []).map((run) => (
              <div
                key={run.id}
                className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {run.name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {formatRunStatus(run.status)} · 完成于 {formatTime(run.finishedAt)}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {run.id}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
