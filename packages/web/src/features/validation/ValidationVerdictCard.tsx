import { useValidationStore } from './validation.store.js';

const RESULT_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  passed: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-300 dark:border-green-700',
    text: 'text-green-700 dark:text-green-300',
    label: '通过',
  },
  failed: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-300 dark:border-red-700',
    text: 'text-red-700 dark:text-red-300',
    label: '失败',
  },
  'manual-review': {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-300 dark:border-yellow-700',
    text: 'text-yellow-700 dark:text-yellow-300',
    label: '需人工审核',
  },
  'rollback-suggested': {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-300 dark:border-orange-700',
    text: 'text-orange-700 dark:text-orange-300',
    label: '建议回滚',
  },
};

const EVIDENCE_ICONS: Record<string, string> = {
  metric: '📊',
  log: '📋',
  screenshot: '📸',
  file: '📄',
  custom: '🔖',
};

export function ValidationVerdictCard() {
  const { verdict, activeRun, observability } = useValidationStore();

  if (!verdict) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-5 text-center text-sm text-gray-500 dark:text-gray-400">
        验证运行未生成结论，可能仍在进行中。
      </div>
    );
  }

  const style = RESULT_STYLES[verdict.result] ?? RESULT_STYLES.failed;

  return (
    <div className={`${style.bg} ${style.border} border rounded-lg overflow-hidden`}>
      {/* Header */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <span className={`text-lg font-bold ${style.text}`}>{style.label}</span>
            <span className="ml-3 text-xs text-gray-500 dark:text-gray-400 font-mono">
              {verdict.id}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(verdict.decidedAt).toLocaleString()}
          </span>
        </div>
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{verdict.summary}</p>
        {verdict.decidedBy && (
          <span className="mt-1 inline-block text-xs text-gray-500 dark:text-gray-400">
            判定者: {verdict.decidedBy}
          </span>
        )}
      </div>

      {/* Observability summary */}
      {observability && (
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">运行期间概览</h4>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Critical</span>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{observability.alertCounts.critical}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Warning</span>
              <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{observability.alertCounts.warning}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Info</span>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{observability.alertCounts.info}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">异常</span>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{observability.exceptionCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Evidence */}
      {verdict.evidence.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            证据 ({verdict.evidence.length})
          </h4>
          <div className="space-y-2">
            {verdict.evidence.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span>{EVIDENCE_ICONS[item.type] ?? '•'}</span>
                <div>
                  <span className="text-gray-700 dark:text-gray-300">{item.description}</span>
                  {item.value !== undefined && (
                    <span className="ml-2 text-xs font-mono text-gray-500 dark:text-gray-400">
                      {String(item.value)}
                    </span>
                  )}
                  {item.reference && (
                    <span className="ml-2 text-xs text-primary-600 dark:text-primary-400 truncate">
                      {item.reference}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run details */}
      {activeRun && (
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
          <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>Run: <span className="font-mono">{activeRun.id}</span></span>
            <span>Plan: <span className="font-mono">{activeRun.planId}</span></span>
            <span>指标数: {activeRun.metrics.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
