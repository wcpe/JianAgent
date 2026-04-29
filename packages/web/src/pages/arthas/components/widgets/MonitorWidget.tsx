import React from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';

interface MonitorRecord {
  timestamp?: number;
  className?: string;
  methodName?: string;
  total?: number;
  success?: number;
  fail?: number;
  avgRt?: number;
  failRate?: number;
}

interface MonitorData {
  records?: MonitorRecord[];
  className?: string;
  methodName?: string;
  interval?: number;
}

interface MonitorWidgetProps {
  readonly data: unknown;
}

export function MonitorWidget({ data }: MonitorWidgetProps) {
  const monitorData = data as MonitorData;
  const records = monitorData?.records ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-pink-400" />
          <span className="text-sm font-medium text-gray-200">方法执行监控</span>
        </div>
        {monitorData?.interval && (
          <span className="text-xs text-gray-400">周期: {monitorData.interval}s</span>
        )}
      </div>

      {(monitorData?.className || monitorData?.methodName) && (
        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-2">
          <div className="text-xs text-gray-400">
            <span className="text-blue-300">{monitorData.className}</span>
            {monitorData.methodName && <span className="text-green-300">.{monitorData.methodName}</span>}
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {records.length === 0 ? (
          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4 text-center">
            <p className="text-sm text-gray-400">等待监控数据...</p>
          </div>
        ) : (
          records.map((record, idx) => (
            <div key={idx} className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-gray-400">
                  {record.timestamp
                    ? new Date(record.timestamp).toLocaleTimeString()
                    : `周期 #${idx + 1}`}
                </div>
                {record.avgRt !== undefined && (
                  <div className="flex items-center gap-1 text-xs text-cyan-400">
                    <TrendingUp className="w-3 h-3" />
                    平均 {record.avgRt.toFixed(2)}ms
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-800/50 rounded px-2 py-1.5">
                  <div className="text-xs text-gray-400">总调用</div>
                  <div className="text-sm font-semibold text-white">
                    {record.total ?? 0}
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded px-2 py-1.5">
                  <div className="text-xs text-gray-400">成功</div>
                  <div className="text-sm font-semibold text-green-400">
                    {record.success ?? 0}
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded px-2 py-1.5">
                  <div className="text-xs text-gray-400">失败</div>
                  <div className="text-sm font-semibold text-red-400">
                    {record.fail ?? 0}
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded px-2 py-1.5">
                  <div className="text-xs text-gray-400">失败率</div>
                  <div className="text-sm font-semibold text-yellow-400">
                    {record.failRate !== undefined
                      ? `${(record.failRate * 100).toFixed(2)}%`
                      : '0%'}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
