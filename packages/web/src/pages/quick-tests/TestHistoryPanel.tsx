import { useState, useMemo } from 'react';
import { StyledSelect } from '../../components/ui/StyledSelect.js';
import { useQuickTestStore, type TestRunRecord } from '../../stores/quick-test.store.js';

type ResultFilter = 'all' | 'success' | 'error' | 'aborted';
type SortDir = 'newest' | 'oldest';

const resultColors: Record<string, string> = {
  success: 'text-green-400',
  error: 'text-red-400',
  aborted: 'text-yellow-400',
};

const resultLabels: Record<string, string> = {
  success: '成功',
  error: '失败',
  aborted: '中止',
};

const filterLabels: Record<ResultFilter, string> = {
  all: '全部',
  success: '成功',
  error: '失败',
  aborted: '中止',
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m${s}s`;
}

export function TestHistoryPanel() {
  const history = useQuickTestStore((s) => s.history);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState<ResultFilter>('all');
  const [sortDir, setSortDir] = useState<SortDir>('newest');

  const filtered = useMemo(() => {
    const list = filter === 'all' ? history : history.filter((r) => r.result === filter);
    return sortDir === 'newest'
      ? list
      : [...list].reverse();
  }, [history, filter, sortDir]);

  if (history.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800/50 shadow-sm dark:shadow-none rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/30"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span>历史记录 ({history.length})</span>
        <span className="text-gray-500">{collapsed ? '▶' : '▼'}</span>
      </button>

      {!collapsed && (
        <div className="overflow-x-auto">
          {/* Filter & count bar */}
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
            <StyledSelect
              variant="compact"
              value={filter}
              onChange={(e) => setFilter(e.target.value as ResultFilter)}
            >
              {(Object.keys(filterLabels) as ResultFilter[]).map((k) => (
                <option key={k} value={k}>{filterLabels[k]}</option>
              ))}
            </StyledSelect>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              显示 {filtered.length} / {history.length}
            </span>
          </div>

          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900/40">
              <tr>
                <th
                  className="px-4 py-2 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => setSortDir(sortDir === 'newest' ? 'oldest' : 'newest')}
                >
                  时间 {sortDir === 'newest' ? '↓' : '↑'}
                </th>
                <th className="px-4 py-2">服务器</th>
                <th className="px-4 py-2">机器人数</th>
                <th className="px-4 py-2">行为</th>
                <th className="px-4 py-2">持续</th>
                <th className="px-4 py-2">结果</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: TestRunRecord) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{new Date(r.startedAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{r.serverName || r.serverId}</td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{r.botCount}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{r.behavior}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{formatDuration(r.duration)}</td>
                  <td className={`px-4 py-2 font-medium ${resultColors[r.result] ?? 'text-gray-400'}`}>
                    {resultLabels[r.result] ?? r.result}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {expanded && (
            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500 dark:text-gray-400">
              {history.find((r) => r.id === expanded)?.errorMessage ?? '无详细信息'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
