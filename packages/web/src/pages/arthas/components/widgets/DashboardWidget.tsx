import React from 'react';
import { Activity, Gauge, TrendingUp } from 'lucide-react';

interface DashboardWidgetProps {
  readonly data: unknown;
}

export function DashboardWidget({ data }: DashboardWidgetProps) {
  // Dashboard 通常是实时流式数据，这里显示提示信息
  return (
    <div className="rounded border border-gray-700 bg-gray-900/40 p-2">
      <div className="flex items-center gap-1.5 mb-2">
        <Gauge className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-xs font-medium text-gray-200">实时监控</span>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-start gap-2 p-2 bg-cyan-900/20 border border-cyan-700/30 rounded">
          <Activity className="w-3 h-3 text-cyan-400 mt-0.5 flex-shrink-0" />
          <div className="text-[11px] text-gray-300">
            <p className="font-medium mb-0.5">Dashboard 是实时流式命令</p>
            <p className="text-gray-400">数据会持续更新，请在左侧终端查看实时输出。</p>
          </div>
        </div>

        <div className="flex items-start gap-2 p-2 bg-gray-800/50 rounded">
          <TrendingUp className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="text-[11px] text-gray-400">
            <p className="mb-0.5">包含实时指标：</p>
            <ul className="list-disc list-inside space-y-0.5 ml-1">
              <li>线程状态与 CPU</li>
              <li>内存使用 (堆/非堆)</li>
              <li>GC 统计</li>
              <li>运行时环境</li>
            </ul>
          </div>
        </div>

        <div className="text-[10px] text-gray-500 text-center pt-1">
          提示: 使用 Ctrl+C 或点击其他命令停止 dashboard
        </div>
      </div>
    </div>
  );
}
