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
    <aside className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
          Evidence
        </p>
        <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">证据抽屉</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          统一查看服务端日志、bot 事件和运行摘要。
        </p>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">当前运行</div>
          <div className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">{run?.name ?? '未选择运行'}</div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{run?.status ?? '等待选择'}</div>
        </div>

        <div className="grid gap-2">
          {loading ? (
            <div className="rounded-xl border border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
              正在同步证据流...
            </div>
          ) : evidence.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              当前运行还没有证据条目。
            </div>
          ) : evidence.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedEvidenceId(item.id)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                selectedEvidence?.id === item.id
                  ? 'border-gray-900 bg-gray-900 text-white dark:border-gray-200 dark:bg-gray-100 dark:text-gray-900'
                  : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{item.kind}</span>
                <span className={`text-xs ${selectedEvidence?.id === item.id ? 'text-white/70 dark:text-gray-500' : 'text-gray-400 dark:text-gray-500'}`}>
                  {item.timestamp}
                </span>
              </div>
              <div className={`mt-2 text-sm ${selectedEvidence?.id === item.id ? 'text-white/85 dark:text-gray-700' : 'text-gray-600 dark:text-gray-300'}`}>
                {item.summary}
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Payload</div>
          <pre className="mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap break-all text-xs text-gray-700 dark:text-gray-300">
            {selectedEvidence ? JSON.stringify(selectedEvidence.payload, null, 2) : '暂无证据详情'}
          </pre>
        </div>
      </div>
    </aside>
  );
}
