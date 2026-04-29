import React from 'react';
import { Code, Braces } from 'lucide-react';

interface MethodInfo {
  declaring?: string;
  methodName?: string;
  descriptor?: string;
  modifier?: string;
  annotation?: string[];
  parameters?: string[];
  returnType?: string;
  exceptions?: string[];
  classLoaderHash?: string;
}

interface SmData {
  methods?: MethodInfo[];
  matchedMethodCount?: number;
}

interface SmWidgetProps {
  readonly data: unknown;
}

export function SmWidget({ data }: SmWidgetProps) {
  const smData = data as SmData;
  const methods = smData?.methods ?? [];
  const matchedCount = smData?.matchedMethodCount ?? methods.length;

  if (methods.length === 0) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4 text-center">
        <Code className="w-8 h-8 text-gray-500 mx-auto mb-2" />
        <p className="text-sm text-gray-400">未找到匹配的方法</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Braces className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-gray-200">方法搜索结果</span>
        </div>
        <span className="text-xs text-gray-400">找到 {matchedCount} 个方法</span>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {methods.map((method, idx) => (
          <div key={idx} className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
            <div className="mb-2">
              {method.modifier && (
                <span className="text-xs text-purple-400 mr-2">{method.modifier}</span>
              )}
              {method.returnType && (
                <span className="text-xs text-blue-400 mr-2">{method.returnType}</span>
              )}
              <span className="font-mono text-sm text-green-300">
                {method.methodName || '未知方法'}
              </span>
            </div>

            {method.descriptor && (
              <div className="text-xs text-gray-400 font-mono mb-1 break-all">
                {method.descriptor}
              </div>
            )}

            {method.declaring && (
              <div className="text-xs text-gray-500 mt-2">
                <span className="text-gray-600">声明类:</span> {method.declaring}
              </div>
            )}

            {method.parameters && method.parameters.length > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                <span className="text-gray-600">参数:</span> {method.parameters.join(', ')}
              </div>
            )}

            {method.exceptions && method.exceptions.length > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                <span className="text-gray-600">异常:</span> {method.exceptions.join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
