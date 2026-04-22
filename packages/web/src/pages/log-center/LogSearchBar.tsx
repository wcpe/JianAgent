import { useState, useEffect, useCallback } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { LogLevel } from '@jian-agent/shared-domain';
import { StyledSelect } from '../../components/ui/StyledSelect.js';
import { useServerStore } from '../../stores/server.store.js';
import { remoteHostApi } from '../../api/remote-host.api.js';
import type { RemoteHostDto } from '@jian-agent/shared-domain';

export interface LogSearchFilters {
  readonly q: string;
  readonly hosts: readonly string[];
  readonly level: string;
  readonly startTime: string;
  readonly endTime: string;
}

interface LogSearchBarProps {
  readonly filters: LogSearchFilters;
  readonly onFiltersChange: (filters: LogSearchFilters) => void;
  readonly onSearch: () => void;
  readonly loading?: boolean;
}

const TIME_RANGES = [
  { label: '最近 1 小时', value: '1h' },
  { label: '最近 6 小时', value: '6h' },
  { label: '最近 24 小时', value: '24h' },
  { label: '最近 7 天', value: '7d' },
  { label: '自定义', value: 'custom' },
] as const;

function timeRangeToDates(range: string): { startTime: string; endTime: string } {
  const now = Date.now();
  const ms: Record<string, number> = {
    '1h': 3_600_000,
    '6h': 21_600_000,
    '24h': 86_400_000,
    '7d': 604_800_000,
  };
  if (ms[range]) {
    return {
      startTime: new Date(now - ms[range]).toISOString(),
      endTime: new Date(now).toISOString(),
    };
  }
  return { startTime: '', endTime: '' };
}

interface HostOption {
  readonly id: string;
  readonly label: string;
}

export function LogSearchBar({ filters, onFiltersChange, onSearch, loading }: LogSearchBarProps) {
  const servers = useServerStore((s) => s.servers);
  const fetchServers = useServerStore((s) => s.fetchServers);
  const [remoteHosts, setRemoteHosts] = useState<readonly RemoteHostDto[]>([]);
  const [hostDropdownOpen, setHostDropdownOpen] = useState(false);
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => { fetchServers(); }, [fetchServers]);

  useEffect(() => {
    remoteHostApi.list().then(setRemoteHosts).catch(() => setRemoteHosts([]));
  }, []);

  const hostOptions: HostOption[] = [
    ...servers.map((s) => ({ id: s.id, label: s.name })),
    ...remoteHosts.map((h) => ({ id: `remote:${h.id}`, label: `[远程] ${h.name}` })),
  ];

  const handleKeywordChange = useCallback((value: string) => {
    onFiltersChange({ ...filters, q: value });
  }, [filters, onFiltersChange]);

  const handleHostToggle = useCallback((hostId: string) => {
    const current = [...filters.hosts];
    const idx = current.indexOf(hostId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(hostId);
    }
    onFiltersChange({ ...filters, hosts: current });
  }, [filters, onFiltersChange]);

  const handleLevelChange = useCallback((level: string) => {
    onFiltersChange({ ...filters, level });
  }, [filters, onFiltersChange]);

  const handleTimeRangeChange = useCallback((range: string) => {
    setTimeRange(range);
    const dates = timeRangeToDates(range);
    onFiltersChange({ ...filters, startTime: dates.startTime, endTime: dates.endTime });
  }, [filters, onFiltersChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSearch();
  }, [onSearch]);

  const selectedHostLabels = hostOptions
    .filter((h) => filters.hosts.includes(h.id))
    .map((h) => h.label);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/75 dark:bg-slate-900/55 backdrop-blur-xl p-3 shadow-lg">
      {/* Keyword input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="搜索日志关键字（支持 FTS5 语法）..."
          value={filters.q}
          onChange={(e) => handleKeywordChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-slate-900/60 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-300 focus:border-transparent backdrop-blur-md"
        />
        {filters.q && (
          <button
            type="button"
            onClick={() => handleKeywordChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Host multi-select */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setHostDropdownOpen(!hostDropdownOpen)}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-slate-900/60 text-gray-800 dark:text-gray-200 hover:bg-white dark:hover:bg-slate-900 transition-colors min-w-[140px]"
        >
          <span className="truncate max-w-[160px]">
            {selectedHostLabels.length === 0
              ? '全部主机'
              : selectedHostLabels.length === 1
                ? selectedHostLabels[0]
                : `${selectedHostLabels.length} 台主机`}
          </span>
          <ChevronDown size={14} className="shrink-0 text-gray-400" />
        </button>
        {hostDropdownOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setHostDropdownOpen(false)} />
            <div className="absolute z-20 top-full left-0 mt-1 w-56 max-h-60 overflow-y-auto rounded-lg border border-white/55 dark:border-primary-300/20 bg-white dark:bg-slate-900 shadow-xl">
              {hostOptions.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400">无可用主机</div>
              )}
              {hostOptions.map((host) => (
                <label
                  key={host.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={filters.hosts.includes(host.id)}
                    onChange={() => handleHostToggle(host.id)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="truncate">{host.label}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Level select */}
      <StyledSelect
        value={filters.level}
        onChange={(e) => handleLevelChange(e.target.value)}
        className="min-w-[100px]"
      >
        <option value="">全部级别</option>
        <option value={LogLevel.DEBUG}>{LogLevel.DEBUG}</option>
        <option value={LogLevel.INFO}>{LogLevel.INFO}</option>
        <option value={LogLevel.WARN}>{LogLevel.WARN}</option>
        <option value={LogLevel.ERROR}>{LogLevel.ERROR}</option>
      </StyledSelect>

      {/* Time range select */}
      <StyledSelect
        value={timeRange}
        onChange={(e) => handleTimeRangeChange(e.target.value)}
        className="min-w-[120px]"
      >
        {TIME_RANGES.map((tr) => (
          <option key={tr.value} value={tr.value}>{tr.label}</option>
        ))}
      </StyledSelect>

      {timeRange === 'custom' && (
        <>
          <input
            type="datetime-local"
            value={filters.startTime ? filters.startTime.slice(0, 16) : ''}
            onChange={(e) => onFiltersChange({ ...filters, startTime: e.target.value ? new Date(e.target.value).toISOString() : '' })}
            className="px-2 py-2 text-sm rounded-lg border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-slate-900/60 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          <input
            type="datetime-local"
            value={filters.endTime ? filters.endTime.slice(0, 16) : ''}
            onChange={(e) => onFiltersChange({ ...filters, endTime: e.target.value ? new Date(e.target.value).toISOString() : '' })}
            className="px-2 py-2 text-sm rounded-lg border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-slate-900/60 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </>
      )}

      {/* Search button */}
      <button
        type="button"
        onClick={onSearch}
        disabled={loading}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 active:scale-95 shadow-lg"
      >
        <Search size={14} />
        搜索
      </button>
    </div>
  );
}
