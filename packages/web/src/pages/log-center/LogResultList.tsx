import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Download, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import type { LogEntryDto, LogSearchResult } from '@jian-agent/shared-domain';
import { logCenterApi } from '../../api/log-center.api.js';

interface LogResultListProps {
  readonly result: LogSearchResult | null;
  readonly loading: boolean;
  readonly page: number;
  readonly onPageChange: (page: number) => void;
  readonly query?: string;
  readonly emptyMessage?: string;
  readonly searchFilters?: {
    readonly q?: string;
    readonly hosts?: readonly string[];
    readonly level?: string;
    readonly startTime?: string;
    readonly endTime?: string;
  };
}

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
  INFO: 'text-info-600 dark:text-info-400 bg-info-50 dark:bg-info-700/30',
  WARN: 'text-warning-600 dark:text-warning-400 bg-warning-50 dark:bg-warning-700/30',
  ERROR: 'text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-700/30',
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

  const levelBg = entry.level === 'ERROR'
    ? 'bg-red-50 dark:bg-red-900/10'
    : entry.level === 'WARN'
      ? 'bg-yellow-50 dark:bg-yellow-900/10'
      : '';

  return (
    <div className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors group ${levelBg}`}>
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
          <pre className="mt-2 text-sm font-mono text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 whitespace-pre-wrap break-all overflow-x-auto">
            {entry.rawLine ?? entry.content}
          </pre>
        </div>
      )}
    </div>
  );
}

export function LogResultList({ result, loading, page, onPageChange, query = '', emptyMessage, searchFilters }: LogResultListProps) {
  const totalPages = result ? Math.ceil(result.total / result.limit) : 0;
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exporting, setExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setExportDropdownOpen(false);
      }
    }
    if (exportDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [exportDropdownOpen]);

  const downloadBlob = useCallback((content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportCurrentPage = useCallback(() => {
    if (!result || result.entries.length === 0) return;
    setExportDropdownOpen(false);
    const dateSuffix = new Date().toISOString().slice(0, 10);
    if (exportFormat === 'json') {
      const json = JSON.stringify(result.entries, null, 2);
      downloadBlob(json, `log-export-page${page}-${dateSuffix}.json`, 'application/json');
    } else {
      const header = 'timestamp,level,host,source,content\n';
      const csv = result.entries.map((e) =>
        `"${e.timestamp}","${e.level}","${e.hostName}","${e.sourceFile}","${e.content.replace(/"/g, '""')}"`
      ).join('\n');
      downloadBlob(header + csv, `log-export-page${page}-${dateSuffix}.csv`, 'text/csv');
    }
  }, [result, page, exportFormat, downloadBlob]);

  const handleExportAll = useCallback(async () => {
    setExportDropdownOpen(false);
    setExporting(true);
    try {
      const res = await logCenterApi.exportAll({
        q: searchFilters?.q,
        hosts: searchFilters?.hosts ? [...searchFilters.hosts] : undefined,
        level: searchFilters?.level,
        startTime: searchFilters?.startTime,
        endTime: searchFilters?.endTime,
        format: exportFormat,
      });
      const dateSuffix = new Date().toISOString().slice(0, 10);
      if (res.data.format === 'json' && res.data.entries) {
        const json = JSON.stringify(res.data.entries, null, 2);
        downloadBlob(json, `log-export-all-${dateSuffix}.json`, 'application/json');
      } else if (res.data.content) {
        downloadBlob(res.data.content, `log-export-all-${dateSuffix}.csv`, 'text/csv');
      }
    } catch {
      // export failed silently
    } finally {
      setExporting(false);
    }
  }, [searchFilters, exportFormat, downloadBlob]);

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
        <div className="flex items-center gap-2">
          {/* Format toggle */}
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
            className="px-2 py-1.5 text-xs rounded-lg border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-gray-900/60 text-gray-600 dark:text-gray-400 focus:outline-none"
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>

          {/* Export dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/80 dark:bg-gray-900/60 border border-white/55 dark:border-primary-300/20 rounded-lg hover:bg-white dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400 transition-colors disabled:opacity-50"
            >
              <Download size={12} />
              {exporting ? '导出中...' : '导出'}
              <ChevronDown size={10} />
            </button>
            {exportDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-white/55 dark:border-primary-300/20 bg-white dark:bg-gray-900 shadow-xl z-20">
                <button
                  type="button"
                  onClick={handleExportCurrentPage}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-t-lg"
                >
                  导出当前页
                </button>
                <button
                  type="button"
                  onClick={handleExportAll}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-b-lg"
                >
                  导出全部 (最多5000条)
                </button>
              </div>
            )}
          </div>
        </div>
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
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
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
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
