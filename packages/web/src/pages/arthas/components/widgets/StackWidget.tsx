import React from 'react';
import { Layers, ArrowDown } from 'lucide-react';

interface StackFrame {
  className?: string;
  methodName?: string;
  lineNumber?: number;
  nativeMethod?: boolean;
}

interface StackData {
  threadName?: string;
  threadId?: number;
  stackTrace?: StackFrame[];
  className?: string;
  methodName?: string;
}

interface StackWidgetProps {
  readonly data: unknown;
}

export function StackWidget({ data }: StackWidgetProps) {
  const stackData = data as StackData;
  const stackTrace = stackData?.stackTrace ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-orange-400" />
        <span className="text-sm font-medium text-gray-200">方法调用堆栈</span>
      </div>

      {(stackData?.className || stackData?.methodName) && (
        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-2">
          <div className="text-xs text-gray-400">
            <span className="text-blue-300">{stackData.className}</span>
            {stackData.methodName && <span className="text-green-300">.{stackData.methodName}</span>}
          </div>
        </div>
      )}

      {stackData?.threadName && (
        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-2">
          <div className="text-xs text-gray-400">
            线程: <span className="text-cyan-300">{stackData.threadName}</span>
            {stackData.threadId && <span className="text-gray-500"> (#{stackData.threadId})</span>}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3 max-h-96 overflow-y-auto">
        {stackTrace.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-4">
            等待方法调用...
          </div>
        ) : (
          <div className="space-y-1">
            {stackTrace.map((frame, idx) => (
              <div key={idx} className="flex items-start gap-2 py-1 hover:bg-gray-800/30 rounded px-2">
                {idx === 0 && <ArrowDown className="w-3 h-3 text-orange-400 mt-0.5 flex-shrink-0" />}
                {idx > 0 && <span className="text-gray-600 text-xs flex-shrink-0">↓</span>}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-blue-300 break-all">
                    {frame.className}.{frame.methodName}
                  </div>
                  {frame.nativeMethod ? (
                    <div className="text-xs text-yellow-400">Native Method</div>
                  ) : frame.lineNumber ? (
                    <div className="text-xs text-gray-500">line {frame.lineNumber}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
