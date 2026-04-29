import React from 'react';
import { History, Play, Trash2 } from 'lucide-react';

interface TtRecord {
  index?: number;
  timestamp?: number;
  cost?: number;
  isReturn?: boolean;
  isThrow?: boolean;
  object?: unknown;
  params?: unknown[];
  returnObj?: unknown;
  throwExp?: string;
}

interface TtData {
  records?: TtRecord[];
  className?: string;
  methodName?: string;
  totalCount?: number;
}

interface TtWidgetProps {
  readonly data: unknown;
}

export function TtWidget({ data }: TtWidgetProps) {
  const ttData = data as TtData;
  const records = ttData?.records ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-gray-200">时间隧道</span>
        </div>
        {ttData?.totalCount && (
          <span className="text-xs text-gray-400">共 {ttData.totalCount} 条记录</span>
        )}
      </div>

      {(ttData?.className || ttData?.methodName) && (
        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-2">
          <div className="text-xs text-gray-400">
            <span className="text-blue-300">{ttData.className}</span>
            {ttData.methodName && <span className="text-green-300">.{ttData.methodName}</span>}
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {records.length === 0 ? (
          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4 text-center">
            <p className="text-sm text-gray-400">暂无记录</p>
            <p className="text-xs text-gray-500 mt-1">使用 tt -t 命令开始记录</p>
          </div>
        ) : (
          records.map((record, idx) => (
            <div key={idx} className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-indigo-400">
                    #{record.index ?? idx}
                  </span>
                  {record.timestamp && (
                    <span className="text-xs text-gray-500">
                      {new Date(record.timestamp).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {record.cost !== undefined && (
                    <span className="text-xs text-cyan-400">{record.cost.toFixed(2)}ms</span>
                  )}
                  <button
                    className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-blue-400"
                    title="重放"
                  >
                    <Play className="w-3 h-3" />
                  </button>
                  <button
                    className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-red-400"
                    title="删除"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {record.params && record.params.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-gray-500 mb-1">参数:</div>
                  <pre className="text-xs text-gray-300 bg-gray-950/50 p-2 rounded overflow-x-auto max-h-32">
                    {JSON.stringify(record.params, null, 2)}
                  </pre>
                </div>
              )}

              {record.isReturn && record.returnObj !== undefined && (
                <div className="mb-2">
                  <div className="text-xs text-gray-500 mb-1">返回值:</div>
                  <pre className="text-xs text-green-300 bg-gray-950/50 p-2 rounded overflow-x-auto max-h-32">
                    {JSON.stringify(record.returnObj, null, 2)}
                  </pre>
                </div>
              )}

              {record.isThrow && record.throwExp && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">异常:</div>
                  <pre className="text-xs text-red-300 bg-gray-950/50 p-2 rounded overflow-x-auto max-h-32">
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
