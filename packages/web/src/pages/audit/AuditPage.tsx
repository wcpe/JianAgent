import { useEffect, useCallback } from 'react';
import { useAuditStore } from '../../stores/audit.store.js';

export function AuditPage() {
  const records = useAuditStore((s) => s.records);
  const total = useAuditStore((s) => s.total);
  const filters = useAuditStore((s) => s.filters);
  const loading = useAuditStore((s) => s.loading);
  const fetchRecords = useAuditStore((s) => s.fetchRecords);
  const setFilters = useAuditStore((s) => s.setFilters);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords, filters]);

  const handleFilterChange = useCallback(
    (key: string, value: string) => {
      setFilters({ [key]: value || undefined, page: 1 });
    },
    [setFilters],
  );

  const handlePageChange = useCallback(
    (delta: number) => {
      const currentPage = filters.page ?? 1;
      const newPage = Math.max(1, currentPage + delta);
      setFilters({ page: newPage });
    },
    [filters.page, setFilters],
  );

  const pageSize = filters.limit ?? 20;
  const currentPage = filters.page ?? 1;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">审计日志</h1>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4 flex gap-4 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 mb-1">用户</label>
          <input
            value={filters.userId ?? ''}
            onChange={(e) => handleFilterChange('userId', e.target.value)}
            placeholder="用户ID"
            className="border rounded px-2 py-1 text-sm w-32"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">操作</label>
          <input
            value={filters.operation ?? ''}
            onChange={(e) => handleFilterChange('operation', e.target.value)}
            placeholder="操作名"
            className="border rounded px-2 py-1 text-sm w-32"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">开始时间</label>
          <input
            type="datetime-local"
            value={filters.startTime ?? ''}
            onChange={(e) => handleFilterChange('startTime', e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">结束时间</label>
          <input
            type="datetime-local"
            value={filters.endTime ?? ''}
            onChange={(e) => handleFilterChange('endTime', e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/55 dark:border-primary-300/20 backdrop-blur-xl bg-white/80 dark:bg-gray-900/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/40 dark:bg-gray-800/40 border-b border-white/40 dark:border-primary-300/10 text-xs text-gray-600 dark:text-gray-300 font-semibold">
              <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-semibold">时间</th>
              <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-semibold">用户</th>
              <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-semibold">操作</th>
              <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-semibold">目标</th>
              <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-semibold">结果</th>
              <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-semibold">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/30 dark:divide-primary-300/10">
            {loading && records.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  加载中...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  暂无记录
                </td>
              </tr>
            ) : (
              records.map((r, idx) => (
                <tr
                  key={r.id}
                  className={`transition-colors ${idx % 2 === 0 ? 'hover:bg-white/50 dark:hover:bg-gray-800/50' : 'bg-white/20 dark:bg-gray-800/10 hover:bg-white/60 dark:hover:bg-gray-800/60'}`}
                >
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(r.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2">{r.username}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.operation}</td>
                  <td className="px-4 py-2">{r.target}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-medium ${r.success ? 'text-success-600' : 'text-danger-600'}`}>
                      {r.success ? '成功' : '失败'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{r.ip}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500 dark:text-gray-400">
          <span>共 {total} 条，第 {currentPage}/{totalPages} 页</span>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(-1)}
              disabled={currentPage <= 1}
              className="px-3 py-1 border dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              上一页
            </button>
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 border dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
