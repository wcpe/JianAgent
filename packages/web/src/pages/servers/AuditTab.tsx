import { useState, useCallback, useEffect, useRef } from 'react';
import { apiFetch } from '../../api/client.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import { Search, Download, RefreshCw, Filter, AlertTriangle } from 'lucide-react';

interface AuditTabProps {
  readonly serverId: string;
}

interface AuditRecord {
  readonly id: string;
  readonly timestamp: string;
  readonly username: string;
  readonly command: string;
  readonly result: 'sent' | 'blocked' | 'failed';
  readonly isDanger: boolean;
}

const RESULT_OPTIONS = [
  { value: 'all', label: '全部结果' },
  { value: 'sent', label: '已发送' },
  { value: 'blocked', label: '已拦截' },
] as const;

export function AuditTab({ serverId }: AuditTabProps) {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [resultFilter, setResultFilter] = useState('all');
  const [dangerOnly, setDangerOnly] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (resultFilter !== 'all') params.set('result', resultFilter);
      if (dangerOnly) params.set('danger', 'true');
      params.set('page', String(page));
      params.set('limit', String(limit));

      const result = await apiFetch<{ items: AuditRecord[]; total: number }>(
        `/servers/${encodeURIComponent(serverId)}/audit?${params.toString()}`,
      );
      setRecords(result.items ?? []);
      setTotal(result.total ?? 0);
    } catch {
      setRecords([]);
      useDialogStore.getState().showToast('审计查询失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [serverId, from, to, searchQuery, resultFilter, dangerOnly, page]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  // Auto-refresh
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoRefresh) {
      timerRef.current = setInterval(fetchAudit, 15_000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, fetchAudit]);

  const exportCsv = () => {
    if (records.length === 0) return;
    const header = '时间,用户,命令,结果,危险\n';
    const rows = records.map((r) =>
      [
        new Date(r.timestamp).toLocaleString(),
        r.username ?? '',
        `"${r.command.replace(/"/g, '""')}"`,
        r.result,
        r.isDanger ? '是' : '否',
      ].join(','),
    );
    const blob = new Blob(['\uFEFF' + header + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${serverId.slice(0, 8)}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchAudit(); } }}
            placeholder="搜索命令或用户..."
            className="pl-7 pr-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-xs w-44"
          />
        </div>

        {/* Date range */}
        <input
          type="datetime-local"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded px-2 py-1 text-xs"
        />
        <span className="text-xs text-gray-400">至</span>
        <input
          type="datetime-local"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded px-2 py-1 text-xs"
        />

        {/* Result filter */}
        <div className="flex items-center gap-1">
          <Filter className="w-3 h-3 text-gray-400" />
          <select
            value={resultFilter}
            onChange={(e) => { setResultFilter(e.target.value); setPage(1); }}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded px-2 py-1 text-xs"
          >
            {RESULT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Danger only */}
        <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 cursor-pointer whitespace-nowrap">
          <AlertTriangle className="w-3 h-3 text-red-500" />
          <input type="checkbox" checked={dangerOnly} onChange={(e) => { setDangerOnly(e.target.checked); setPage(1); }} className="rounded" />
          仅危险
        </label>

        <div className="flex-1" />

        {/* Auto-refresh */}
        <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded" />
          <RefreshCw className={`w-3 h-3 ${autoRefresh ? 'animate-spin text-blue-500' : ''}`} />
          自动刷新
        </label>

        {/* Query button */}
        <button
          onClick={() => { setPage(1); fetchAudit(); }}
          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 active:scale-95 transition-all duration-150 whitespace-nowrap shrink-0"
        >
          查询
        </button>

        {/* Export CSV */}
        <button
          onClick={exportCsv}
          disabled={records.length === 0}
          className="flex items-center gap-1 px-2 py-1 border border-gray-300 dark:border-gray-600 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-40 whitespace-nowrap shrink-0"
        >
          <Download className="w-3 h-3" />
          导出
        </button>
      </div>

      {/* Audit records */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-white/55 dark:border-primary-300/20 backdrop-blur-xl bg-white/80 dark:bg-gray-900/60">
        {loading ? (
          <div className="flex justify-center py-8 text-gray-400 dark:text-gray-500 text-sm">加载中...</div>
        ) : records.length === 0 ? (
          <div className="flex justify-center py-8 text-gray-400 dark:text-gray-500 text-sm">无审计记录</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0">
              <tr className="bg-white/40 dark:bg-gray-800/40 border-b border-white/40 dark:border-primary-300/10 text-xs text-gray-600 dark:text-gray-300 font-semibold">
                <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-300 font-semibold w-40">时间</th>
                <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-300 font-semibold w-24">用户</th>
                <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-300 font-semibold">命令</th>
                <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-300 font-semibold w-16">结果</th>
                <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-300 font-semibold w-16">危险</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/30 dark:divide-primary-300/10">
              {records.map((r, idx) => (
                <tr
                  key={r.id}
                  className={`transition-colors ${idx % 2 === 0 ? 'hover:bg-white/50 dark:hover:bg-gray-800/50' : 'bg-white/20 dark:bg-gray-800/10 hover:bg-white/60 dark:hover:bg-gray-800/60'} ${r.isDanger ? 'bg-red-50/70 dark:bg-red-900/20' : ''}`}
                >
                  <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">
                    {new Date(r.timestamp).toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{r.username ?? '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-gray-800 dark:text-gray-200">
                    {searchQuery ? highlightText(r.command, searchQuery) : r.command}
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        r.result === 'sent'
                          ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                          : r.result === 'blocked'
                            ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      }`}
                    >
                      {r.result}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    {r.isDanger && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
          <span>共 {total} 条</span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              上一页
            </button>
            <span className="px-2 py-1">{page} / {Math.ceil(total / limit)}</span>
            <button
              disabled={page >= Math.ceil(total / limit)}
              onClick={() => setPage((p) => p + 1)}
              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function highlightText(text: string, query: string) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-700 text-inherit rounded-sm px-0.5">{part}</mark>
      : part,
  );
}
