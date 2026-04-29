import React from 'react';
import { Sliders, Copy } from 'lucide-react';

interface VmoptionData {
  options?: Record<string, string>;
  key?: string;
  value?: string;
  updatable?: boolean;
}

interface VmoptionWidgetProps {
  readonly data: unknown;
}

export function VmoptionWidget({ data }: VmoptionWidgetProps) {
  const vmoptionData = data as VmoptionData;
  const options = vmoptionData?.options ?? {};
  const entries = Object.entries(options);

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
  };

  // Single option view
  if (vmoptionData?.key && vmoptionData?.value !== undefined) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium text-gray-200">VM 选项</span>
        </div>

        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-400">{vmoptionData.key}</div>
            {vmoptionData.updatable && (
              <span className="text-xs px-1.5 py-0.5 bg-green-900/30 text-green-400 rounded">
                可修改
              </span>
            )}
          </div>
          <div className="flex items-start gap-2 bg-gray-950/50 p-2 rounded">
            <pre className="text-xs text-violet-300 flex-1 break-all">{vmoptionData.value}</pre>
            <button
              onClick={() => handleCopy(vmoptionData.value!)}
              className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-blue-400 flex-shrink-0"
              title="复制"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // All options view
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium text-gray-200">VM 选项</span>
        </div>
        <span className="text-xs text-gray-400">{entries.length} 个选项</span>
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3 max-h-96 overflow-y-auto">
        <div className="space-y-2">
          {entries.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-4">无 VM 选项</div>
          ) : (
            entries.map(([key, value]) => (
              <div key={key} className="bg-gray-800/50 rounded p-2">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs text-gray-300 font-mono break-all">{key}</span>
                  <button
                    onClick={() => handleCopy(value)}
                    className="p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-blue-400 flex-shrink-0"
                    title="复制值"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-xs text-violet-300 break-all">{value}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-2">
        <div className="text-xs text-gray-500">
          提示: 使用 <code className="text-cyan-300 bg-gray-950/50 px-1 rounded">vmoption &lt;name&gt; &lt;value&gt;</code> 修改可更新的选项
        </div>
      </div>
    </div>
  );
}
