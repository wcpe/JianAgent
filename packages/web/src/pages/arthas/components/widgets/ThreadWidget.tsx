import React, { useState, useMemo } from 'react';
import { Activity, Clock, Layers, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface ThreadStat {
  id: number;
  name: string;
  state: string;
  cpu: number;
  time: number;
  daemon: boolean;
  priority: number;
}

interface ThreadData {
  threadStateCount?: Record<string, number>;
  threadStats?: ThreadStat[];
}

interface ThreadWidgetProps {
  readonly data: unknown;
}

type SortField = 'cpu' | 'time' | 'id' | 'priority';
type SortOrder = 'asc' | 'desc';

// CPU 使用率迷你图表组件
function CpuSparkline({ value }: { value: number }) {
  const bars = 10;
  const maxHeight = 16;
  const barWidth = 2;
  const gap = 1;
  
  // 生成模拟历史数据（实际应用中应从真实数据源获取）
  const history = useMemo(() => {
    const data = [];
    for (let i = 0; i < bars; i++) {
      // 模拟波动，最后一个值是当前值
      if (i === bars - 1) {
        data.push(value);
      } else {
        data.push(Math.max(0, value + (Math.random() - 0.5) * 20));
      }
    }
    return data;
  }, [value]);

  const maxValue = Math.max(...history, 1);

  return (
    <div className="flex items-end gap-[1px]" style={{ height: maxHeight }}>
      {history.map((val, idx) => {
        const height = (val / maxValue) * maxHeight;
        const isLast = idx === bars - 1;
        return (
          <div
            key={idx}
            className={`${isLast ? 'bg-green-400' : 'bg-green-600/60'}`}
            style={{
              width: barWidth,
              height: Math.max(1, height),
            }}
          />
        );
      })}
    </div>
  );
}

// 状态标签组件
function StateLabel({ state }: { state: string }) {
  const colors: Record<string, string> = {
    RUNNABLE: 'bg-green-500/20 text-green-400 border-green-500/30',
    WAITING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    TIMED_WAITING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    BLOCKED: 'bg-red-500/20 text-red-400 border-red-500/30',
    NEW: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    TERMINATED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  const colorClass = colors[state] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] border ${colorClass} font-medium`}>
      {state}
    </span>
  );
}

export function ThreadWidget({ data }: ThreadWidgetProps) {
  const threadData = data as ThreadData;
  const stateCount = threadData?.threadStateCount ?? {};
  const threads = threadData?.threadStats ?? [];

  const [sortField, setSortField] = useState<SortField>('cpu');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterState, setFilterState] = useState<string>('');

  // 排序和筛选
  const sortedThreads = useMemo(() => {
    let filtered = threads;
    if (filterState) {
      filtered = threads.filter(t => t.state === filterState);
    }

    return [...filtered].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const multiplier = sortOrder === 'asc' ? 1 : -1;
      return (aVal > bVal ? 1 : -1) * multiplier;
    });
  }, [threads, sortField, sortOrder, filterState]);

  const topThreads = sortedThreads.slice(0, 20);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortOrder === 'asc' ? 
      <ArrowUp className="w-3 h-3 text-blue-400" /> : 
      <ArrowDown className="w-3 h-3 text-blue-400" />;
  };

  return (
    <div className="space-y-2">
      {/* 紧凑的状态统计条 */}
      <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-gray-700 bg-gray-900/40">
        <Layers className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          {Object.entries(stateCount).map(([state, count]) => (
            <button
              key={state}
              onClick={() => setFilterState(filterState === state ? '' : state)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                filterState === state 
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' 
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              <span className="font-medium">{state}</span>
              <span className="text-gray-400">×{count}</span>
            </button>
          ))}
          {filterState && (
            <button
              onClick={() => setFilterState('')}
              className="text-gray-400 hover:text-gray-200 underline"
            >
              清除
            </button>
          )}
        </div>
      </div>

      {/* 紧凑的表格布局 */}
      <div className="rounded border border-gray-700 bg-gray-900/40 overflow-hidden">
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-700">
          <Activity className="w-3.5 h-3.5 text-green-400" />
          <span className="text-xs font-medium text-gray-200">
            Top {topThreads.length}
          </span>
        </div>

        {/* 表头 */}
        <div className="grid grid-cols-[35px_1fr_70px_70px_75px_45px_40px] gap-1.5 px-2 py-1 bg-gray-800/50 text-[10px] font-medium text-gray-400 border-b border-gray-700">
          <button
            onClick={() => handleSort('id')}
            className="flex items-center gap-0.5 hover:text-gray-200 transition-colors"
          >
            ID
            <SortIcon field="id" />
          </button>
          <div>线程名</div>
          <button
            onClick={() => handleSort('cpu')}
            className="flex items-center gap-0.5 hover:text-gray-200 transition-colors"
          >
            CPU
            <SortIcon field="cpu" />
          </button>
          <button
            onClick={() => handleSort('time')}
            className="flex items-center gap-0.5 hover:text-gray-200 transition-colors"
          >
            时间
            <SortIcon field="time" />
          </button>
          <div>状态</div>
          <button
            onClick={() => handleSort('priority')}
            className="flex items-center gap-0.5 hover:text-gray-200 transition-colors"
          >
            优先级
            <SortIcon field="priority" />
          </button>
          <div>守护</div>
        </div>

        {/* 表体 */}
        <div className="max-h-[500px] overflow-y-auto">
          {topThreads.map((thread, idx) => (
            <div
              key={thread.id}
              className={`grid grid-cols-[35px_1fr_70px_70px_75px_45px_40px] gap-1.5 px-2 py-1 text-[11px] hover:bg-gray-800/30 transition-colors ${
                idx % 2 === 0 ? 'bg-gray-900/20' : ''
              }`}
            >
              <span className="text-gray-400 font-mono text-[10px]">#{thread.id}</span>
              <span className="text-gray-200 truncate font-medium" title={thread.name}>
                {thread.name}
              </span>
              <div className="flex items-center gap-1.5">
                <CpuSparkline value={thread.cpu} />
                <span className="text-gray-300 font-mono text-[10px]">
                  {thread.cpu.toFixed(1)}%
                </span>
              </div>
              <span className="text-gray-300 font-mono text-[10px]">{thread.time}ms</span>
              <StateLabel state={thread.state} />
              <span className="text-gray-300 text-center text-[10px]">{thread.priority}</span>
              <span className="text-center">
                {thread.daemon ? (
                  <span className="text-orange-400">✓</span>
                ) : (
                  <span className="text-gray-600">-</span>
                )}
              </span>
            </div>
          ))}
        </div>

        {topThreads.length === 0 && (
          <div className="px-2 py-6 text-center text-gray-500 text-xs">
            {filterState ? `没有 ${filterState} 状态的线程` : '暂无线程数据'}
          </div>
        )}
      </div>
    </div>
  );
}
