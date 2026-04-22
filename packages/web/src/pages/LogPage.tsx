import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { LogAggregateSearchResponseDto } from '@jian-agent/shared-domain';
import { logsApi } from '../api/logs.api.js';
import { serverApi } from '../api/server.api.js';

type QuickRangePreset = '15m' | '1h' | '6h' | '24h' | '7d' | 'custom';

const QUICK_RANGE_OPTIONS: ReadonlyArray<{ value: Exclude<QuickRangePreset, 'custom'>; label: string; minutes: number }> = [
  { value: '15m', label: '15 分钟', minutes: 15 },
  { value: '1h', label: '1 小时', minutes: 60 },
  { value: '6h', label: '6 小时', minutes: 360 },
  { value: '24h', label: '24 小时', minutes: 1440 },
  { value: '7d', label: '7 天', minutes: 10080 },
];

function toDatetimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function LogPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultEnvelope, setResultEnvelope] = useState<LogAggregateSearchResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverIdInput, setServerIdInput] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [activeQuickRange, setActiveQuickRange] = useState<QuickRangePreset>('custom');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [field, setField] = useState<'content' | 'file' | 'both'>('content');
  const [recentEnvelope, setRecentEnvelope] = useState<LogAggregateSearchResponseDto | null>(null);

  // Read URL parameters on mount
  useEffect(() => {
    const urlQuery = searchParams.get('query');
    const urlServerId = searchParams.get('serverId');
    
    if (urlQuery) {
      setQuery(urlQuery);
    }
    if (urlServerId) {
      setServerIdInput(urlServerId);
    }
  }, [searchParams]);

  const serverIds = useMemo(
    () => serverIdInput.split(',').map((item) => item.trim()).filter(Boolean),
    [serverIdInput],
  );

  const applyQuickRange = (minutes: number, preset: Exclude<QuickRangePreset, 'custom'>) => {
    const end = new Date();
    const start = new Date(end.getTime() - minutes * 60 * 1000);
    setStartTime(toDatetimeLocalValue(start));
    setEndTime(toDatetimeLocalValue(end));
    setActiveQuickRange(preset);
  };

  const clearTimeWindow = () => {
    setStartTime('');
    setEndTime('');
    setActiveQuickRange('custom');
  };

  const runSearch = async () => {
    if (!query.trim()) {
      setResultEnvelope(null);
      setError('请输入搜索关键字');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const normalizedServerIds = serverIds.length > 0
        ? serverIds
        : (await serverApi.listServers()).map((item) => item.id);

      const data = await logsApi.aggregateSearch({
        query: query.trim(),
        serverIds: normalizedServerIds,
        maxPerServer: 100,
        maxTotal: 500,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        caseSensitive,
        fields: field === 'both' ? ['content', 'file'] : [field],
      });
      setResultEnvelope(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadRecent = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await logsApi.recent({
        serverIds: serverIds.length > 0 ? serverIds : undefined,
        linesPerServer: 100,
        maxTotal: 300,
      });
      setRecentEnvelope(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!query.trim()) {
      void loadRecent();
    }
  }, [query, serverIdInput]);

  const results = resultEnvelope?.entries ?? [];
  const recentResults = recentEnvelope?.entries ?? [];

  return (
    <div className="p-6 space-y-5">
      <div className="rounded-3xl border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs tracking-[0.28em] uppercase text-slate-400 mb-2">LOG EXPLORER</div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">日志检索台</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              直接查看最近日志，或切换到关键字聚合模式按服务器、时间窗和匹配字段收敛结果。
            </p>
          </div>
          {!query.trim() && (
            <button
              type="button"
              onClick={loadRecent}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-white/55 dark:border-primary-300/20 bg-white/85 dark:bg-slate-900/60 text-sm text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-slate-900"
            >
              {loading ? '刷新中...' : '刷新最近日志'}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl p-5 space-y-3">
        <label htmlFor="log-query" className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
          聚合关键字搜索
        </label>
        <input
          id="log-query"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入关键字过滤日志..."
          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
        />

        <label htmlFor="server-ids" className="block text-sm text-gray-600 dark:text-gray-400">
          服务器筛选（可选，逗号分隔 serverId）
        </label>
        <input
          id="server-ids"
          type="text"
          value={serverIdInput}
          onChange={(e) => setServerIdInput(e.target.value)}
          placeholder="例如: srv-1,srv-2"
          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="start-time" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">开始时间（可选）</label>
            <input
              id="start-time"
              type="datetime-local"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                setActiveQuickRange('custom');
              }}
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label htmlFor="end-time" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">结束时间（可选）</label>
            <input
              id="end-time"
              type="datetime-local"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                setActiveQuickRange('custom');
              }}
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-700 dark:text-gray-300">快速时间窗</span>
          {QUICK_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => applyQuickRange(option.minutes, option.value)}
              className={`px-2.5 py-1 rounded border text-xs transition-colors ${
                activeQuickRange === option.value
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={clearTimeWindow}
            className="px-2.5 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            清空
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
            />
            区分大小写
          </label>

          <label htmlFor="search-field" className="text-sm text-gray-700 dark:text-gray-300">匹配字段</label>
          <select
            id="search-field"
            value={field}
            onChange={(e) => setField(e.target.value as 'content' | 'file' | 'both')}
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
          >
            <option value="content">内容</option>
            <option value="file">文件名</option>
            <option value="both">内容+文件名</option>
          </select>
        </div>

        <button
          type="button"
          onClick={runSearch}
          disabled={loading}
          className="px-4 py-2 rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 text-sm"
        >
          {loading ? '查询中...' : '开始聚合查询'}
        </button>
      </div>

      <div className="rounded-3xl border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl p-5 text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {query.trim() ? '聚合查询结果' : '最近日志'}
          </h2>
          {!query.trim() && recentEnvelope && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              后端：{recentEnvelope.backend}
              {recentEnvelope.degraded && recentEnvelope.degradationReason ? `，降级：${recentEnvelope.degradationReason}` : ''}
            </div>
          )}
        </div>
        {error && <div className="text-red-600 dark:text-red-400 mb-2">{error}</div>}
        {!error && resultEnvelope && (
          <div className={`mb-3 rounded border px-3 py-2 text-xs ${
            resultEnvelope.degraded
              ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
              : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          }`}>
            日志后端：{resultEnvelope.backend}
            {resultEnvelope.requestedBackend && resultEnvelope.requestedBackend !== resultEnvelope.backend
              ? `（请求 ${resultEnvelope.requestedBackend}）`
              : ''}
            {resultEnvelope.degraded && resultEnvelope.degradationReason
              ? `，已降级：${resultEnvelope.degradationReason}`
              : ''}
          </div>
        )}
        {!error && !query.trim() && recentResults.length === 0 && '暂无最近日志'}
        {!error && query.trim() && results.length === 0 && '暂无匹配日志'}
        {results.length > 0 && (
          <div className="overflow-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-3">serverId</th>
                  <th className="py-2 pr-3">file</th>
                  <th className="py-2 pr-3">line</th>
                  <th className="py-2 pr-3">content</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item, idx) => (
                  <tr key={`${item.serverId}:${item.file}:${item.line}:${idx}`} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-1 pr-3 font-mono">{item.serverId}</td>
                    <td className="py-1 pr-3">{item.file}</td>
                    <td className="py-1 pr-3">{item.line}</td>
                    <td className="py-1 pr-3 font-mono break-all">{item.content}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!query.trim() && recentResults.length > 0 && (
          <div className="overflow-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-3">serverId</th>
                  <th className="py-2 pr-3">file</th>
                  <th className="py-2 pr-3">line</th>
                  <th className="py-2 pr-3">content</th>
                </tr>
              </thead>
              <tbody>
                {recentResults.map((item, idx) => (
                  <tr key={`${item.serverId}:${item.file}:${item.line}:${idx}`} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-1 pr-3 font-mono">{item.serverId}</td>
                    <td className="py-1 pr-3">{item.file}</td>
                    <td className="py-1 pr-3">{item.line}</td>
                    <td className="py-1 pr-3 font-mono break-all">{item.content}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
