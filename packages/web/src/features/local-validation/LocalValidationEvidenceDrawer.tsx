import { useMemo, useState } from 'react';
import type {
  LocalValidationEvidenceDto,
  LocalValidationRunDto,
} from '../../api/local-validation.api.js';

interface LocalValidationEvidenceDrawerProps {
  readonly run: LocalValidationRunDto | null;
  readonly evidence: readonly LocalValidationEvidenceDto[];
  readonly loading: boolean;
}

export function LocalValidationEvidenceDrawer({
  run,
  evidence,
  loading,
}: LocalValidationEvidenceDrawerProps) {
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);

  const selectedEvidence = useMemo(
    () => evidence.find((item) => item.id === selectedEvidenceId) ?? evidence[0] ?? null,
    [evidence, selectedEvidenceId],
  );

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
          Evidence
        </p>
        <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">证据抽屉</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          统一查看服务端日志、bot 事件和运行摘要。
        </p>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">当前运行</div>
          <div className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{run?.name ?? '未选择运行'}</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{run?.status ?? '等待选择'}</div>
        </div>

        <div className="grid gap-2">
          {loading ? (
            <div className="rounded-xl border border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
              正在同步证据流...
            </div>
          ) : evidence.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              当前运行还没有证据条目。
            </div>
          ) : evidence.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedEvidenceId(item.id)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                selectedEvidence?.id === item.id
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{item.kind}</span>
                <span className={`text-xs ${selectedEvidence?.id === item.id ? 'text-white/70 dark:text-slate-500' : 'text-slate-400 dark:text-slate-500'}`}>
                  {item.timestamp}
                </span>
              </div>
              <div className={`mt-2 text-sm ${selectedEvidence?.id === item.id ? 'text-white/85 dark:text-slate-700' : 'text-slate-600 dark:text-slate-300'}`}>
                {item.summary}
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Payload</div>
          <pre className="mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap break-all text-xs text-slate-700 dark:text-slate-300">
            {selectedEvidence ? JSON.stringify(selectedEvidence.payload, null, 2) : '暂无证据详情'}
          </pre>
        </div>
      </div>
    </aside>
  );
}
