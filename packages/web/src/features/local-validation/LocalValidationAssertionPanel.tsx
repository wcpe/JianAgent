import type {
  LocalValidationAssertionDto,
  LocalValidationRunDto,
} from '../../api/local-validation.api.js';

interface LocalValidationAssertionPanelProps {
  readonly run: LocalValidationRunDto | null;
  readonly assertions: readonly LocalValidationAssertionDto[];
  readonly loading: boolean;
}

function assertionTone(status: LocalValidationAssertionDto['status']): string {
  if (status === 'passed') {
    return 'text-emerald-600 dark:text-emerald-300';
  }
  if (status === 'failed') {
    return 'text-rose-600 dark:text-rose-300';
  }
  return 'text-gray-500 dark:text-gray-400';
}

export function LocalValidationAssertionPanel({
  run,
  assertions,
  loading,
}: LocalValidationAssertionPanelProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
            Assertions
          </p>
          <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">断言面板</h2>
        </div>
        {run ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {(assertions ?? []).filter((item) => item.status === 'passed').length}/{(assertions ?? []).length} 通过
          </div>
        ) : null}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
        {!run ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">选择一个运行后查看断言结果。</div>
        ) : loading ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">正在同步断言结果...</div>
        ) : (assertions ?? []).length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">当前运行还没有断言记录。</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-950">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">断言</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">阶段</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">阈值</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">实际值</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-900">
              {(assertions ?? []).map((assertion) => (
                <tr key={assertion.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{assertion.title}</div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{assertion.message}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{assertion.stageId}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{assertion.threshold}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{assertion.actual}</td>
                  <td className={`px-4 py-3 font-medium ${assertionTone(assertion.status)}`}>{assertion.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
