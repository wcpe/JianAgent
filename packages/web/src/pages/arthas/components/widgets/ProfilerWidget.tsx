import React from 'react';
import { Flame, Download } from 'lucide-react';

interface ProfilerData {
  status?: 'running' | 'stopped' | 'idle';
  duration?: number;
  samples?: number;
  file?: string;
  event?: string;
  output?: string;
}

interface ProfilerWidgetProps {
  readonly data: unknown;
}

export function ProfilerWidget({ data }: ProfilerWidgetProps) {
  const profilerData = data as ProfilerData;
  const status = profilerData?.status ?? 'idle';

  const statusColor = {
    running: 'text-green-400',
    stopped: 'text-yellow-400',
    idle: 'text-gray-400',
  }[status];

  const statusBg = {
    running: 'bg-green-900/30',
    stopped: 'bg-yellow-900/30',
    idle: 'bg-gray-800/30',
  }[status];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-medium text-gray-200">性能分析器</span>
        </div>
        <span className={`text-xs px-2 py-1 rounded ${statusBg} ${statusColor}`}>
          {status === 'running' ? '运行中' : status === 'stopped' ? '已停止' : '空闲'}
        </span>
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3 space-y-3">
        {profilerData?.event && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">事件类型</span>
            <span className="text-xs text-cyan-300 font-mono">{profilerData.event}</span>
          </div>
        )}

        {profilerData?.duration !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">持续时间</span>
            <span className="text-xs text-white">{profilerData.duration}s</span>
          </div>
        )}

        {profilerData?.samples !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">采样数</span>
            <span className="text-xs text-white">{profilerData.samples.toLocaleString()}</span>
          </div>
        )}

        {profilerData?.file && (
          <div className="pt-2 border-t border-gray-700">
            <div className="text-xs text-gray-400 mb-2">输出文件</div>
            <div className="flex items-center gap-2 bg-gray-950/50 p-2 rounded">
              <span className="text-xs text-blue-300 font-mono flex-1 break-all">
                {profilerData.file}
              </span>
              <button
                className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-blue-400"
                title="下载"
              >
                <Download className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {profilerData?.output && (
          <div className="pt-2 border-t border-gray-700">
            <div className="text-xs text-gray-400 mb-2">输出信息</div>
            <pre className="text-xs text-gray-300 bg-gray-950/50 p-2 rounded overflow-x-auto max-h-48">
              {profilerData.output}
            </pre>
          </div>
        )}

        {status === 'idle' && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-400">使用以下命令开始分析:</p>
            <code className="text-xs text-cyan-300 bg-gray-950/50 px-2 py-1 rounded mt-2 inline-block">
              profiler start
            </code>
          </div>
        )}
      </div>
    </div>
  );
}
