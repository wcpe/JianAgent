import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Radio } from 'lucide-react';
import { ErrorAlert } from '../../components/ui/ErrorAlert.js';
import { LogSearchBar, type LogSearchFilters } from './LogSearchBar.js';
import { LogResultList } from './LogResultList.js';
import { LogAnalyticsPanel } from './LogAnalyticsPanel.js';
import { logCenterApi } from '../../api/log-center.api.js';
import { useWsChannel } from '../../ws/use-ws-channel.js';
import { useServerContext } from '../../stores/server-context.store.js';
import type { LogSearchResult, LogAnalyticsResult, LogAggregateSearchResponseDto, LogEntryDto } from '@jian-agent/shared-domain';
import type { LogEntryPayload } from '@jian-agent/shared-protocol';

const DEFAULT_FILTERS: LogSearchFilters = {
  q: '',
  hosts: [],
  level: '',
  startTime: new Date(Date.now() - 86_400_000).toISOString(),
  endTime: new Date().toISOString(),
};

export function LogCenterPage() {
  const contextServerId = useServerContext((s) => s.currentServerId);
  const [filters, setFilters] = useState<LogSearchFilters>(() => ({
    ...DEFAULT_FILTERS,
    hosts: contextServerId ? [contextServerId] : [],
  }));
  const [page, setPage] = useState(1);
  const [searchResult, setSearchResult] = useState<LogSearchResult | null>(null);
  const [analytics, setAnalytics] = useState<LogAnalyticsResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamEntries, setStreamEntries] = useState<LogEntryDto[]>([]);
  const streamRef = useRef<HTMLDivElement>(null);

  const handleStreamEntry = useCallback((payload: LogEntryPayload) => {
    if (!streaming) return;
    setStreamEntries((prev) => [payload.entry, ...prev].slice(0, 200));
  }, [streaming]);

  useWsChannel('resource:log:entry', handleStreamEntry);

  const toSearchResult = useCallback((recent: LogAggregateSearchResponseDto): LogSearchResult => ({
    entries: recent.entries.map((entry, index) => ({
      id: index + 1,
      hostId: entry.serverId,
      hostName: entry.serverId,
      hostType: 'server',
      sourceFile: entry.file,
      timestamp: '',
      level: 'INFO',
      content: entry.content,
      rawLine: entry.content,
    })),
    total: recent.entries.length,
    page: 1,
    limit: recent.entries.length || 1,
    highlightMap: new Map(),
  }), []);

  const loadRecent = useCallback(async () => {
    setSearching(true);
    setAnalyticsLoading(true);
    setError(null);
    setPage(1);
    try {
      const [recentRes, analyticsRes] = await Promise.all([
        logCenterApi.recent({
          serverIds: filters.hosts.length > 0 ? filters.hosts : undefined,
          linesPerServer: 80,
          maxTotal: 240,
        }),
        logCenterApi.analytics({
          hosts: filters.hosts.length > 0 ? filters.hosts : undefined,
          level: filters.level || undefined,
          startTime: filters.startTime || undefined,
          endTime: filters.endTime || undefined,
        }),
      ]);
      setSearchResult(toSearchResult(recentRes));
      setAnalytics(analyticsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSearchResult(null);
      setAnalytics(null);
    } finally {
      setSearching(false);
      setAnalyticsLoading(false);
    }
  }, [filters, toSearchResult]);

  const handleSearch = useCallback(async () => {
    if (!filters.q.trim()) {
      await loadRecent();
      return;
    }
    setSearching(true);
    setAnalyticsLoading(true);
    setError(null);
    setPage(1);
    try {
      const [searchRes, analyticsRes] = await Promise.all([
        logCenterApi.search({
          q: filters.q || undefined,
          hosts: filters.hosts.length > 0 ? filters.hosts : undefined,
          level: filters.level || undefined,
          startTime: filters.startTime || undefined,
          endTime: filters.endTime || undefined,
          page: 1,
          limit: 50,
          highlight: true,
        }),
        logCenterApi.analytics({
          hosts: filters.hosts.length > 0 ? filters.hosts : undefined,
          level: filters.level || undefined,
          startTime: filters.startTime || undefined,
          endTime: filters.endTime || undefined,
        }),
      ]);
      setSearchResult(searchRes);
      setAnalytics(analyticsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSearchResult(null);
      setAnalytics(null);
    } finally {
      setSearching(false);
      setAnalyticsLoading(false);
    }
  }, [filters, loadRecent]);

  const handlePageChange = useCallback(async (newPage: number) => {
    setPage(newPage);
    setSearching(true);
    try {
      const res = await logCenterApi.search({
        q: filters.q || undefined,
        hosts: filters.hosts.length > 0 ? filters.hosts : undefined,
        level: filters.level || undefined,
        startTime: filters.startTime || undefined,
        endTime: filters.endTime || undefined,
        page: newPage,
        limit: 50,
        highlight: true,
      });
      setSearchResult(res);
    } catch {
      // keep previous results
    } finally {
      setSearching(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  return (
    <div className="flex flex-col h-[calc(100vh-24px)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-5 pb-3">
        <Search size={22} className="text-primary-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">日志中心</h1>
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => { setStreaming((s) => !s); if (streaming) setStreamEntries([]); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              streaming
                ? 'bg-success-500 text-white shadow-md shadow-success-500/30'
                : 'bg-white/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Radio size={14} className={streaming ? 'animate-pulse' : ''} />
            {streaming ? '实时流 ON' : '实时流'}
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-6 pb-4">
        <LogSearchBar
          filters={filters}
          onFiltersChange={setFilters}
          onSearch={handleSearch}
          loading={searching}
        />
      </div>

      {error && (
        <div className="px-6 pb-2">
          <ErrorAlert message={error} />
        </div>
      )}

      {/* Live stream panel */}
      {streaming && (
        <div className="px-6 pb-3">
          <div ref={streamRef} className="rounded-2xl border border-success-200 dark:border-success-700/40 bg-gray-950 text-gray-200 max-h-[240px] overflow-y-auto font-mono text-xs shadow-inner">
            <div className="sticky top-0 bg-gray-950/95 backdrop-blur-sm px-4 py-2 border-b border-gray-800 flex items-center gap-2">
              <Radio size={12} className="text-success-400 animate-pulse" />
              <span className="text-success-400 text-[11px] font-semibold uppercase tracking-wider">实时日志流</span>
              <span className="text-gray-500 ml-auto text-[11px]">{streamEntries.length} 条</span>
            </div>
            {streamEntries.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-500">等待日志条目...</div>
            ) : (
              <div className="divide-y divide-gray-800/50">
                {streamEntries.map((entry, i) => (
                  <div key={`${entry.timestamp}-${i}`} className="px-4 py-1.5 hover:bg-gray-900/50 flex gap-3">
                    <span className="text-gray-500 shrink-0 w-[140px]">{entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('zh-CN', { hour12: false, fractionalSecondDigits: 3 }) : '-'}</span>
                    <span className={`shrink-0 w-[50px] font-medium ${entry.level === 'ERROR' ? 'text-danger-400' : entry.level === 'WARN' ? 'text-warning-400' : entry.level === 'DEBUG' ? 'text-gray-500' : 'text-info-400'}`}>{entry.level}</span>
                    <span className="text-gray-400 shrink-0 max-w-[120px] truncate">{entry.hostName || entry.hostId}</span>
                    <span className="text-gray-200 truncate">{entry.content}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main content: results + analytics */}
      <div className="flex-1 flex gap-4 px-6 pb-4 min-h-0">
        {/* Left: results list */}
        <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/75 dark:bg-gray-900/55 backdrop-blur-xl shadow-xl overflow-hidden">
          <LogResultList
            result={searchResult}
            loading={searching}
            page={page}
            onPageChange={handlePageChange}
            query={filters.q}
            emptyMessage="暂无日志结果，可直接查看最近日志或输入关键字执行全文检索。"
            searchFilters={{
              q: filters.q || undefined,
              hosts: filters.hosts.length > 0 ? filters.hosts : undefined,
              level: filters.level || undefined,
              startTime: filters.startTime || undefined,
              endTime: filters.endTime || undefined,
            }}
          />
        </div>

        {/* Right: analytics panel */}
        <div className="w-[340px] shrink-0 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/75 dark:bg-gray-900/55 backdrop-blur-xl shadow-xl overflow-hidden">
          <LogAnalyticsPanel analytics={analytics} loading={analyticsLoading} />
        </div>
      </div>
    </div>
  );
}
