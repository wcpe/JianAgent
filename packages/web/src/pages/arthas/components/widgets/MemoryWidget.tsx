import React from 'react';
import { MemoryStick, TrendingUp } from 'lucide-react';

interface MemoryPoolInfo {
  name?: string;
  type?: string;
  init?: number;
  used?: number;
  committed?: number;
  max?: number;
  usagePercent?: number;
}

interface MemoryData {
  heapMemory?: MemoryPoolInfo;
  nonHeapMemory?: MemoryPoolInfo;
  pools?: MemoryPoolInfo[];
  bufferPools?: Array<{
    name?: string;
    count?: number;
    memoryUsed?: number;
    totalCapacity?: number;
  }>;
}

interface MemoryWidgetProps {
  readonly data: unknown;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function MemoryBar({ used, max, label }: { used?: number; max?: number; label: string }) {
  const percent = used && max ? (used / max) * 100 : 0;
  const color = percent > 90 ? 'bg-red-500' : percent > 70 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-300">
          {formatBytes(used)} / {formatBytes(max)} ({percent.toFixed(1)}%)
        </span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function MemoryWidget({ data }: MemoryWidgetProps) {
  const memoryData = data as MemoryData;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MemoryStick className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-medium text-gray-200">内存详情</span>
      </div>

      {/* Heap Memory */}
      {memoryData?.heapMemory && (
        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-3 h-3 text-green-400" />
            <span className="text-xs font-medium text-gray-200">堆内存</span>
          </div>
          <MemoryBar
            used={memoryData.heapMemory.used}
            max={memoryData.heapMemory.max}
            label="Heap"
          />
        </div>
      )}

      {/* Non-Heap Memory */}
      {memoryData?.nonHeapMemory && (
        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-3 h-3 text-blue-400" />
            <span className="text-xs font-medium text-gray-200">非堆内存</span>
          </div>
          <MemoryBar
            used={memoryData.nonHeapMemory.used}
            max={memoryData.nonHeapMemory.max}
            label="Non-Heap"
          />
        </div>
      )}

      {/* Memory Pools */}
      {memoryData?.pools && memoryData.pools.length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
          <div className="text-xs font-medium text-gray-200 mb-3">内存池</div>
          <div className="space-y-3">
            {memoryData.pools.map((pool, idx) => (
              <div key={idx}>
                <MemoryBar
                  used={pool.used}
                  max={pool.max}
                  label={pool.name || `Pool ${idx + 1}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buffer Pools */}
      {memoryData?.bufferPools && memoryData.bufferPools.length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
          <div className="text-xs font-medium text-gray-200 mb-3">缓冲池</div>
          <div className="space-y-2">
            {memoryData.bufferPools.map((pool, idx) => (
              <div key={idx} className="bg-gray-800/50 rounded p-2">
                <div className="text-xs text-gray-300 mb-1">{pool.name}</div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>数量: {pool.count}</span>
                  <span>容量: {formatBytes(pool.totalCapacity)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
