import React from 'react';
import { HardDrive, Download, CheckCircle } from 'lucide-react';

interface HeapdumpData {
  status?: 'success' | 'running' | 'failed';
  file?: string;
  size?: number;
  live?: boolean;
  message?: string;
}

interface HeapdumpWidgetProps {
  readonly data: unknown;
}

export function HeapdumpWidget({ data }: HeapdumpWidgetProps) {
  const heapdumpData = data as HeapdumpData;
  const status = heapdumpData?.status ?? 'running';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-gray-200">堆转储</span>
        </div>
        {status === 'success' && (
          <CheckCircle className="w-4 h-4 text-green-400" />
        )}
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3 space-y-3">
        {status === 'running' && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2"></div>
            <p className="text-sm text-gray-400">正在生成堆转储文件...</p>
          </div>
        )}

        {status === 'failed' && (
          <div className="text-center py-4">
            <p className="text-sm text-red-400">堆转储失败</p>
            {heapdumpData?.message && (
              <p className="text-xs text-gray-400 mt-2">{heapdumpData.message}</p>
            )}
          </div>
        )}

        {status === 'success' && (
          <>
            {heapdumpData?.live !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">仅存活对象</span>
                <span className="text-xs text-white">
                  {heapdumpData.live ? '是' : '否'}
                </span>
              </div>
            )}

            {heapdumpData?.size !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">文件大小</span>
                <span className="text-xs text-white">
                  {(heapdumpData.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            )}

            {heapdumpData?.file && (
              <div className="pt-2 border-t border-gray-700">
                <div className="text-xs text-gray-400 mb-2">文件路径</div>
                <div className="flex items-center gap-2 bg-gray-950/50 p-2 rounded">
                  <span className="text-xs text-blue-300 font-mono flex-1 break-all">
                    {heapdumpData.file}
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

            {heapdumpData?.message && (
              <div className="pt-2 border-t border-gray-700">
                <div className="text-xs text-green-300">{heapdumpData.message}</div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-2">
        <div className="text-xs text-gray-500">
          提示: 使用 <code className="text-cyan-300 bg-gray-950/50 px-1 rounded">heapdump --live</code> 仅转储存活对象
        </div>
      </div>
    </div>
  );
}
