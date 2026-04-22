import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Download, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import type { LogEntryDto, LogSearchResult } from '@jian-agent/shared-domain';

interface LogResultListProps {
  readonly result: LogSearchResult | null;
  readonly loading: boolean;
  readonly page: number;
  readonly onPageChange: (page: number) => void;
  readonly query?: string;
  readonly emptyMessage?: string;
}

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
  INFO: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
  WARN: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30',
  ERROR: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30',
};

function formatTimestamp(ts: string): string {
  if (!ts) return '-';
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

function highlightContent(content: string, query: string): React.ReactNode {
  if (!query.trim()) return content;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = content.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-700 text-inherit rounded px-0.5">{part}</mark>
      : part
  );
}

function LogEntryRow({ entry, query }: { entry: LogEntryDto; query: string }) {
  const [expanded, setExpanded] = useState(false);
  const levelClass = LEVEL_COLORS[entry.level] ?? LEVEL_COLORS.INFO;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(entry.rawLine ?? entry.content).catch(() => {});
  }, [entry]);

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors group">
      <div className="flex items-start gap-3 px-4 py-2.5">
        {/* Timestamp */}
        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap tabular-nums min-w-[120px] shrink-0 pt-0.5">
          {formatTimestamp(entry.timestamp)}
        </span>

        {/* Level badge */}
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${levelClass}`}>
          {entry.level}
        </span>

        {/* Host name */}
        <span className="text-xs text-primary-500 dark:text-primary-400 shrink-0 min-w-[80px] truncate pt-0.5" title={entry.hostName}>
          {entry.hostName}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 dark:text-gray-200 font-mono leading-relaxed break-all line-clamp-2">
            {highlightContent(entry.content, query)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            title="复制"
          >
            <Copy size={13} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            title={expanded ? '收起' : '展开'}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-3 pl-[155px]">
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>主机: {entry.hostName} ({entry.hostType})</p>
            <p>来源: {entry.sourceFile}</p>
            <p>ID: {entry.id}</p>
          </div>
          <pre className="mt-2 text-sm font-mono text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-slate-800 rounded-lg p-3 whitespace-pre-wrap break-all overflow-x-auto">
            {entry.rawLine ?? entry.content}
          </pre>
        </div>
      )}
    </div>
  );
}

export function LogResultList({ result, loading, page, onPageChange, query = '', emptyMessage }: LogResultListProps) {
  const totalPages = result ? Math.ceil(result.total / result.limit) : 0;

  const handleExport = useCallback(() => {
    if (!result || result.entries.length === 0) return;
    const header = 'timestamp,level,host,source,content\n';
    const csv = result.entries.map((e) =>
      `"${e.timestamp}","${e.level}","${e.hostName}","${e.sourceFile}","${e.content.replace(/"/g, '""')}"`
    ).join('\n');
    const blob = new Blob([header + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `log-export-page${page}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, page]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[200px]">
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">搜索中...</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[200px]">
        <p className="text-gray-400 dark:text-gray-500 text-sm">{emptyMessage ?? '输入关键字搜索日志，支持 FTS5 全文搜索语法'}</p>
      </div>
    );
  }

  if (result.entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[200px]">
        <p className="text-gray-400 dark:text-gray-500 text-sm">未找到匹配的日志条目</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          共 <strong className="text-gray-700 dark:text-gray-300">{result.total}</strong> 条结果
          （第 {result.page} / {totalPages} 页）
        </span>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/80 dark:bg-slate-900/60 border border-white/55 dark:border-primary-300/20 rounded-lg hover:bg-white dark:hover:bg-slate-900 text-gray-600 dark:text-gray-400 transition-colors"
        >
          <Download size={12} />
          导出 CSV
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {result.entries.map((entry) => (
          <LogEntryRow key={entry.id} entry={entry} query={query} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 7) {
              pageNum = i + 1;
            } else if (page <= 4) {
              pageNum = i + 1;
            } else if (page >= totalPages - 3) {
              pageNum = totalPages - 6 + i;
            } else {
              pageNum = page - 3 + i;
            }
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                  pageNum === page
                    ? 'bg-primary-600 text-white font-medium shadow-lg'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
