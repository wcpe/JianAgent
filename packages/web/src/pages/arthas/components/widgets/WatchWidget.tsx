import React from 'react';
import { Eye, Clock, AlertCircle } from 'lucide-react';

interface WatchRecord {
  ts?: number;
  cost?: number;
  params?: unknown[];
  returnObj?: unknown;
  throwExp?: string;
  isReturn?: boolean;
  isThrow?: boolean;
}

interface WatchData {
  records?: WatchRecord[];
  className?: string;
  methodName?: string;
  totalCount?: number;
}

interface WatchWidgetProps {
  readonly data: unknown;
}

export function WatchWidget({ data }: WatchWidgetProps) {
  const watchData = data as WatchData;
  const records = watchData?.records ?? [];
  const className = watchData?.className ?? '';
  const methodName = watchData?.methodName ?? '';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-gray-200">方法监控</span>
        </div>
        {watchData?.totalCount && (
          <span className="text-xs text-gray-400">共 {watchData.totalCount} 次调用</span>
        )}
      </div>

      {(className || methodName) && (
        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-2">
          <div className="text-xs text-gray-400">
            <span className="text-blue-300">{className}</span>
            {methodName && <span className="text-green-300">.{methodName}</span>}
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {records.length === 0 ? (
          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4 text-center">
            <p className="text-sm text-gray-400">等待方法调用...</p>
          </div>
        ) : (
          records.map((record, idx) => (
            <div key={idx} className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {record.isThrow ? (
                    <AlertCircle className="w-3 h-3 text-red-400" />
                  ) : (
                    <Clock className="w-3 h-3 text-green-400" />
                  )}
                  <span className="text-xs text-gray-400">
                    {record.ts ? new Date(record.ts).toLocaleTimeString() : `调用 #${idx + 1}`}
                  </span>
                </div>
                {record.cost !== undefined && (
                  <span className="text-xs text-cyan-400">{record.cost.toFixed(2)}ms</span>
                )}
              </div>

              {record.params && record.params.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-gray-500 mb-1">参数:</div>
                  <pre className="text-xs text-gray-300 bg-gray-950/50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(record.params, null, 2)}
                  </pre>
                </div>
              )}

              {record.isReturn && record.returnObj !== undefined && (
                <div className="mb-2">
                  <div className="text-xs text-gray-500 mb-1">返回值:</div>
                  <pre className="text-xs text-green-300 bg-gray-950/50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(record.returnObj, null, 2)}
                  </pre>
                </div>
              )}

              {record.isThrow && record.throwExp && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">异常:</div>
                  <pre className="text-xs text-red-300 bg-gray-950/50 p-2 rounded overflow-x-auto">
                    {record.throwExp}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
