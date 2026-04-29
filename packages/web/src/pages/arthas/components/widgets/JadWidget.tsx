import React from 'react';
import { FileText, Copy } from 'lucide-react';

interface JadData {
  source?: string;
  className?: string;
  classLoaderHash?: string;
  location?: string;
}

interface JadWidgetProps {
  readonly data: unknown;
}

export function JadWidget({ data }: JadWidgetProps) {
  const jadData = data as JadData;
  const source = jadData?.source ?? '';
  const className = jadData?.className ?? '未知类';

  const handleCopy = () => {
    navigator.clipboard.writeText(source);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-medium text-gray-200">反编译结果</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
          title="复制代码"
        >
          <Copy className="w-3 h-3" />
          复制
        </button>
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
        <div className="text-xs text-gray-400 mb-2">
          <span className="text-gray-500">类名:</span> {className}
        </div>
        {jadData?.location && (
          <div className="text-xs text-gray-500 mb-3 break-all">
            <span className="text-gray-600">位置:</span> {jadData.location}
          </div>
        )}
        <pre className="text-xs text-gray-200 overflow-x-auto bg-gray-950/50 p-3 rounded border border-gray-800">
          <code>{source || '无反编译内容'}</code>
        </pre>
      </div>
    </div>
  );
}
