import React from 'react';
import { Globe, Copy } from 'lucide-react';

interface SysenvData {
  env?: Record<string, string>;
  key?: string;
  value?: string;
}

interface SysenvWidgetProps {
  readonly data: unknown;
}

export function SysenvWidget({ data }: SysenvWidgetProps) {
  const sysenvData = data as SysenvData;
  const env = sysenvData?.env ?? {};
  const entries = Object.entries(env);

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
  };

  // Single env var view
  if (sysenvData?.key && sysenvData?.value) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-gray-200">系统环境变量</span>
        </div>

        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
          <div className="text-xs text-gray-400 mb-2">{sysenvData.key}</div>
          <div className="flex items-start gap-2 bg-gray-950/50 p-2 rounded">
            <pre className="text-xs text-emerald-300 flex-1 break-all">{sysenvData.value}</pre>
            <button
              onClick={() => handleCopy(sysenvData.value!)}
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

  // All env vars view
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-gray-200">系统环境变量</span>
        </div>
        <span className="text-xs text-gray-400">{entries.length} 个变量</span>
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3 max-h-96 overflow-y-auto">
        <div className="space-y-2">
          {entries.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-4">无环境变量</div>
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
                <div className="text-xs text-emerald-300 break-all">{value}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
