import { useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { StyledSelect } from '../ui/StyledSelect.js';

export interface LogFilterState {
  readonly levels: string[];
  readonly keyword: string;
  readonly startTime: string;
  readonly endTime: string;
}

export const INITIAL_LOG_FILTERS: LogFilterState = {
  levels: [],
  keyword: '',
  startTime: '',
  endTime: '',
};

export interface LogFilterToolbarProps {
  readonly filters: LogFilterState;
  readonly onFiltersChange: (filters: LogFilterState) => void;
  readonly showTimeRange?: boolean;
  readonly compact?: boolean;
}

const LEVEL_OPTIONS = [
  { value: 'ERROR', label: 'ERROR', color: 'bg-danger-500/20 text-danger-600 dark:text-danger-400 border-danger-400/40' },
  { value: 'WARN', label: 'WARN', color: 'bg-warning-500/20 text-warning-600 dark:text-warning-400 border-warning-400/40' },
  { value: 'INFO', label: 'INFO', color: 'bg-info-500/20 text-info-600 dark:text-info-400 border-info-400/40' },
  { value: 'DEBUG', label: 'DEBUG', color: 'bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-400/40' },
] as const;

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

export function LogFilterToolbar({ filters, onFiltersChange, showTimeRange = false, compact = false }: LogFilterToolbarProps) {
  const [timeRange, setTimeRange] = useState('24h');

  const toggleLevel = useCallback((level: string) => {
    const current = [...filters.levels];
    const idx = current.indexOf(level);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(level);
    }
    onFiltersChange({ ...filters, levels: current });
  }, [filters, onFiltersChange]);

  const handleKeywordChange = useCallback((value: string) => {
    onFiltersChange({ ...filters, keyword: value });
  }, [filters, onFiltersChange]);

  const handleTimeRangeChange = useCallback((range: string) => {
    setTimeRange(range);
    const dates = timeRangeToDates(range);
    onFiltersChange({ ...filters, startTime: dates.startTime, endTime: dates.endTime });
  }, [filters, onFiltersChange]);

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/75 dark:bg-gray-900/55 backdrop-blur-xl p-3 shadow-lg ${compact ? 'flex-nowrap' : 'flex-wrap'}`}
    >
      {/* Level checkboxes */}
      <div className="flex items-center gap-1.5">
        {LEVEL_OPTIONS.map((opt) => {
          const active = filters.levels.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleLevel(opt.value)}
              className={`px-2 py-1 text-xs font-medium rounded-md border transition-all ${
                active
                  ? opt.color
                  : 'bg-white/60 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 border-white/40 dark:border-gray-700 opacity-60'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Keyword input */}
      <div className="relative flex-1 min-w-[180px]">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="搜索关键字..."
          value={filters.keyword}
          onChange={(e) => handleKeywordChange(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-gray-900/60 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-300 focus:border-transparent backdrop-blur-md"
        />
        {filters.keyword && (
          <button
            type="button"
            onClick={() => handleKeywordChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Time range (optional) */}
      {showTimeRange && (
        <>
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
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    startTime: e.target.value ? new Date(e.target.value).toISOString() : '',
                  })
                }
                className="px-2 py-2 text-sm rounded-lg border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-gray-900/60 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
              <input
                type="datetime-local"
                value={filters.endTime ? filters.endTime.slice(0, 16) : ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    endTime: e.target.value ? new Date(e.target.value).toISOString() : '',
                  })
                }
                className="px-2 py-2 text-sm rounded-lg border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-gray-900/60 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
