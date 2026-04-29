import React from 'react';
import { Cpu, HardDrive, Zap, Database } from 'lucide-react';

interface MemoryUsage {
  init: number;
  used: number;
  committed: number;
  max: number;
}

interface JvmData {
  RUNTIME?: Array<{ name: string; value: string | number }>;
  'CLASS-LOADING'?: Array<{ name: string; value: number }>;
  MEMORY?: Array<{ name: string; value: MemoryUsage | number }>;
  THREAD?: Array<{ name: string; value: number }>;
  'OPERATING-SYSTEM'?: Array<{ name: string; value: string | number }>;
}

interface JvmWidgetProps {
  readonly data: unknown;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function JvmWidget({ data }: JvmWidgetProps) {
  const jvmData = data as JvmData;
  
  const runtime = jvmData?.RUNTIME ?? [];
  const classLoading = jvmData?.['CLASS-LOADING'] ?? [];
  const memory = jvmData?.MEMORY ?? [];
  const thread = jvmData?.THREAD ?? [];
  const os = jvmData?.['OPERATING-SYSTEM'] ?? [];

  const heapMemory = memory.find(m => m.name === 'HEAP-MEMORY-USAGE')?.value as MemoryUsage | undefined;
  const nonHeapMemory = memory.find(m => m.name === 'NO-HEAP-MEMORY-USAGE')?.value as MemoryUsage | undefined;

  return (
    <div className="space-y-2 max-h-full overflow-y-auto">
      {/* Runtime Info */}
      {runtime.length > 0 && (
        <div className="rounded border border-gray-700 bg-gray-900/40 p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-xs font-medium text-gray-200">运行时</span>
          </div>
          <div className="space-y-0.5">
            {runtime.slice(0, 5).map((item, idx) => (
              <div key={idx} className="flex justify-between text-[11px]">
                <span className="text-gray-400 truncate mr-2">{item.name}</span>
                <span className="text-gray-200 font-mono flex-shrink-0">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Memory Usage */}
      {heapMemory && (
        <div className="rounded border border-gray-700 bg-gray-900/40 p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-medium text-gray-200">堆内存</span>
          </div>
          <div className="space-y-1.5">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-gray-400">已使用</span>
                <span className="text-gray-200">{formatBytes(heapMemory.used)} / {formatBytes(heapMemory.max)}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div 
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(heapMemory.used / heapMemory.max) * 100}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div>
                <span className="text-gray-400">初始: </span>
                <span className="text-gray-200">{formatBytes(heapMemory.init)}</span>
              </div>
              <div>
                <span className="text-gray-400">已提交: </span>
                <span className="text-gray-200">{formatBytes(heapMemory.committed)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Non-Heap Memory */}
      {nonHeapMemory && (
        <div className="rounded border border-gray-700 bg-gray-900/40 p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <HardDrive className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs font-medium text-gray-200">非堆内存</span>
          </div>
          <div className="space-y-0.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-gray-400">已使用</span>
              <span className="text-gray-200">{formatBytes(nonHeapMemory.used)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">已提交</span>
              <span className="text-gray-200">{formatBytes(nonHeapMemory.committed)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Thread Info */}
      {thread.length > 0 && (
        <div className="rounded border border-gray-700 bg-gray-900/40 p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Cpu className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs font-medium text-gray-200">线程</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {thread.map((item, idx) => (
              <div key={idx} className="bg-gray-800/50 rounded px-1.5 py-1">
                <div className="text-[10px] text-gray-400">{item.name}</div>
                <div className="text-xs font-semibold text-white">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OS Info */}
      {os.length > 0 && (
        <div className="rounded border border-gray-700 bg-gray-900/40 p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Cpu className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs font-medium text-gray-200">操作系统</span>
          </div>
          <div className="space-y-0.5">
            {os.map((item, idx) => (
              <div key={idx} className="flex justify-between text-[11px]">
                <span className="text-gray-400 truncate mr-2">{item.name}</span>
                <span className="text-gray-200 font-mono flex-shrink-0">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
