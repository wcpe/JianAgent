import { useEffect, useState, useRef, useCallback, useMemo, type JSX } from 'react';
import { useWsChannel } from '../../ws/use-ws-channel.js';
import { apiFetch } from '../../api/client.js';
import { WsChannel } from '@jian-agent/shared-protocol';
import { LogFilterToolbar, INITIAL_LOG_FILTERS, type LogFilterState } from '../../components/log/LogFilterToolbar.js';
import { LogExportButton } from '../../components/log/LogExportButton.js';

interface NodeLogEntry {
  readonly timestamp: string;
  readonly level: string;
  readonly context: string;
  readonly message: string;
  readonly raw: string;
}

const MAX_ENTRIES = 2000;

const LEVEL_BADGE_COLORS: Record<string, string> = {
  FATAL: 'bg-red-700 text-white',
  ERROR: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  WARN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  INFO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  DEBUG: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export function NodeLogTerm() {
  const [entries, setEntries] = useState<NodeLogEntry[]>([]);
  const [filters, setFilters] = useState<LogFilterState>(INITIAL_LOG_FILTERS);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch history on mount
  useEffect(() => {
    apiFetch<{ entries?: NodeLogEntry[]; lines?: string[] }>('/node-log/history?format=structured')
      .then((res) => {
        if (res.entries) {
          setEntries(res.entries.slice(-MAX_ENTRIES));
        } else if (res.lines) {
          // Backward compat: convert raw lines
          setEntries((Array.isArray(res.lines) ? res.lines : []).map(raw => ({
            timestamp: '', level: 'INFO', context: '', message: raw, raw,
          })).slice(-MAX_ENTRIES));
        }
      })
      .catch(() => {});
  }, []);

  // Subscribe to realtime updates
  const handleWsData = useCallback((payload: { data: NodeLogEntry | string }) => {
    if (!payload?.data) return;
    const entry: NodeLogEntry = typeof payload.data === 'string'
      ? { timestamp: '', level: 'INFO', context: '', message: payload.data, raw: payload.data }
      : payload.data;
    setEntries(prev => {
      const next = [...prev, entry];
      return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
    });
  }, []);

  useWsChannel(WsChannel.TERMINAL_SESSION_NODE_LOG, handleWsData);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries, autoScroll]);

  // Handle user scroll
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  // Filter entries client-side
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (filters.levels.length && !filters.levels.includes(e.level)) return false;
      if (filters.keyword) {
        const lower = filters.keyword.toLowerCase();
        if (!e.message.toLowerCase().includes(lower) && !e.raw.toLowerCase().includes(lower)) return false;
      }
      return true;
    });
  }, [entries, filters]);

  // Export entries
  const exportEntries = useMemo(() =>
    filteredEntries.map(e => ({
      timestamp: e.timestamp,
      level: e.level,
      source: e.context,
      content: e.message,
    })),
    [filteredEntries],
  );

  // Highlight keyword in text
  const highlightText = (text: string, keyword: string) => {
    if (!keyword) return text;
    const parts: JSX.Element[] = [];
    const lower = text.toLowerCase();
    const lowerK = keyword.toLowerCase();
    let pos = 0;
    let key = 0;
    while (pos < text.length) {
      const idx = lower.indexOf(lowerK, pos);
      if (idx === -1) { parts.push(<span key={key++}>{text.slice(pos)}</span>); break; }
      if (idx > pos) parts.push(<span key={key++}>{text.slice(pos, idx)}</span>);
      parts.push(<mark key={key++} className="bg-yellow-300 dark:bg-yellow-700 rounded px-0.5">{text.slice(idx, idx + keyword.length)}</mark>);
      pos = idx + keyword.length;
    }
    return <>{parts}</>;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Filter toolbar */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center gap-2 flex-wrap">
        <LogFilterToolbar filters={filters} onFiltersChange={setFilters} showTimeRange={false} compact />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {filteredEntries.length} / {entries.length}
          </span>
          <LogExportButton entries={exportEntries} filename="node-log" />
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto font-mono text-xs bg-gray-50 dark:bg-gray-900"
      >
        {filteredEntries.map((entry, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 px-3 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 ${
              entry.level === 'ERROR' || entry.level === 'FATAL' ? 'bg-red-50/50 dark:bg-red-950/20' : ''
            }`}
          >
            <span className="text-gray-400 w-16 shrink-0 text-right select-none">{entry.timestamp ? entry.timestamp.split(' ').pop()?.split(',')[0] ?? '' : ''}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium w-12 text-center shrink-0 ${LEVEL_BADGE_COLORS[entry.level] ?? LEVEL_BADGE_COLORS.INFO}`}>
              {entry.level}
            </span>
            {entry.context && (
              <span className="text-purple-500 dark:text-purple-400 shrink-0">[{entry.context}]</span>
            )}
            <span className="text-gray-800 dark:text-gray-200 break-all">
              {highlightText(entry.message, filters.keyword)}
            </span>
          </div>
        ))}
        {filteredEntries.length === 0 && entries.length > 0 && (
          <div className="text-center text-gray-400 py-8">No matching log entries</div>
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <button
          onClick={() => { setAutoScroll(true); containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' }); }}
          className="absolute bottom-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-xs shadow-lg hover:bg-blue-600"
        >
          Follow latest
        </button>
      )}
    </div>
  );
}
