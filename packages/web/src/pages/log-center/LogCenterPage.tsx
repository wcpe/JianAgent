import { useState, useCallback, useEffect } from 'react';
import { Search } from 'lucide-react';
import { LogSearchBar, type LogSearchFilters } from './LogSearchBar.js';
import { LogResultList } from './LogResultList.js';
import { LogAnalyticsPanel } from './LogAnalyticsPanel.js';
import { logCenterApi } from '../../api/log-center.api.js';
import type { LogSearchResult, LogAnalyticsResult, LogAggregateSearchResponseDto } from '@jian-agent/shared-domain';

const DEFAULT_FILTERS: LogSearchFilters = {
  q: '',
  hosts: [],
  level: '',
  startTime: new Date(Date.now() - 86_400_000).toISOString(),
  endTime: new Date().toISOString(),
};

export function LogCenterPage() {
  const [filters, setFilters] = useState<LogSearchFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [searchResult, setSearchResult] = useState<LogSearchResult | null>(null);
  const [analytics, setAnalytics] = useState<LogAnalyticsResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        </div>
      )}

      {/* Main content: results + analytics */}
      <div className="flex-1 flex gap-4 px-6 pb-4 min-h-0">
        {/* Left: results list */}
        <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/75 dark:bg-slate-900/55 backdrop-blur-xl shadow-xl overflow-hidden">
          <LogResultList
            result={searchResult}
            loading={searching}
            page={page}
            onPageChange={handlePageChange}
            query={filters.q}
            emptyMessage="暂无日志结果，可直接查看最近日志或输入关键字执行全文检索。"
          />
        </div>

        {/* Right: analytics panel */}
        <div className="w-[340px] shrink-0 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/75 dark:bg-slate-900/55 backdrop-blur-xl shadow-xl overflow-hidden">
          <LogAnalyticsPanel analytics={analytics} loading={analyticsLoading} />
        </div>
      </div>
    </div>
  );
}
