import React from 'react';
import { HardDrive, FileText, Database, Activity, Cpu } from 'lucide-react';
import type { StorageStats as StorageStatsType } from '../../../api/diagnostic-file.api';

interface StorageStatsProps {
  stats: StorageStatsType | null;
  loading: boolean;
}

const FILE_TYPE_LABELS: Record<string, string> = {
  'thread-dump': '线程转储',
  'heap-dump': '堆转储',
  'jfr': 'JFR 录制',
  'cpu-sample': 'CPU 采样',
};

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  'thread-dump': <FileText className="w-4 h-4" />,
  'heap-dump': <Database className="w-4 h-4" />,
  'jfr': <Activity className="w-4 h-4" />,
  'cpu-sample': <Cpu className="w-4 h-4" />,
};

const FILE_TYPE_COLORS: Record<string, string> = {
  'thread-dump': 'bg-blue-500',
  'heap-dump': 'bg-purple-500',
  'jfr': 'bg-green-500',
  'cpu-sample': 'bg-orange-500',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function StorageStats({ stats, loading }: StorageStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const totalSizeFormatted = formatBytes(stats.totalSize);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {/* 总存储 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <HardDrive className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-600">总存储</span>
        </div>
        <div className="text-2xl font-bold text-gray-900">{totalSizeFormatted}</div>
        <div className="text-xs text-gray-500 mt-1">{stats.totalFiles} 个文件</div>
      </div>

      {/* 各类型统计 */}
      {Object.entries(stats.byType).map(([type, data]) => (
        <div key={type} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-gray-600">{FILE_TYPE_ICONS[type]}</div>
            <span className="text-sm font-medium text-gray-600">{FILE_TYPE_LABELS[type]}</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatBytes(data.size)}</div>
          <div className="text-xs text-gray-500 mt-1">{data.count} 个文件</div>
          {stats.totalSize > 0 && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${FILE_TYPE_COLORS[type]}`}
                  style={{ width: `${(data.size / stats.totalSize) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
