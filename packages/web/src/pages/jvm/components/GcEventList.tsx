import React, { useMemo } from 'react';
import { Trash2, Clock, TrendingUp } from 'lucide-react';
import type { MonitoringSnapshot } from '../../../hooks/useJvmMonitoring';

interface GcEventListProps {
  snapshots: MonitoringSnapshot[];
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)} ms`;
  }
  return `${(ms / 1000).toFixed(2)} s`;
}

export const GcEventList: React.FC<GcEventListProps> = ({ snapshots }) => {
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  // Calculate GC rate (collections per minute)
  const gcRate = useMemo(() => {
    if (snapshots.length < 2) return 0;
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const timeDiffMinutes = (last.timestamp - first.timestamp) / 60000;
    const collectionDiff = last.gc.totalCollections - first.gc.totalCollections;
    return timeDiffMinutes > 0 ? collectionDiff / timeDiffMinutes : 0;
  }, [snapshots]);

  // Calculate average GC pause time
  const avgPauseTime = useMemo(() => {
    if (!latestSnapshot || latestSnapshot.gc.totalCollections === 0) return 0;
    return latestSnapshot.gc.totalCollectionTimeMs / latestSnapshot.gc.totalCollections;
  }, [latestSnapshot]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">GC 统计信息</h3>
        {latestSnapshot && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
            <div>
              <span className="text-gray-600 dark:text-gray-400">总 GC 次数:</span>
              <div className="font-semibold text-blue-600 dark:text-blue-400">
                {latestSnapshot.gc.totalCollections}
              </div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">总 GC 时间:</span>
              <div className="font-semibold text-yellow-600 dark:text-yellow-400">
                {formatDuration(latestSnapshot.gc.totalCollectionTimeMs)}
              </div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">平均暂停时间:</span>
              <div className={`font-semibold ${
                avgPauseTime > 100 ? 'text-red-600 dark:text-red-400' :
                avgPauseTime > 50 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-green-600 dark:text-green-400'
              }`}>
                {formatDuration(avgPauseTime)}
              </div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">GC 频率:</span>
              <div className="font-semibold text-purple-600 dark:text-purple-400">
                {gcRate.toFixed(2)} 次/分钟
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GC Collectors Table */}
      {latestSnapshot && latestSnapshot.gc.collectors.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300 font-semibold">
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    收集器名称
                  </div>
                </th>
                <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300 font-semibold">
                  <div className="flex items-center justify-end gap-2">
                    <TrendingUp className="w-4 h-4" />
                    收集次数
                  </div>
                </th>
                <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300 font-semibold">
                  <div className="flex items-center justify-end gap-2">
                    <Clock className="w-4 h-4" />
                    总时间
                  </div>
                </th>
                <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300 font-semibold">
                  平均时间
                </th>
              </tr>
            </thead>
            <tbody>
              {latestSnapshot.gc.collectors.map((collector, index) => {
                const avgTime = collector.collectionCount > 0 
                  ? collector.collectionTimeMs / collector.collectionCount 
                  : 0;
                
                return (
                  <tr 
                    key={index}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-2 px-3 text-gray-900 dark:text-white font-medium">
                      {collector.name}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                      {collector.collectionCount}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                      {formatDuration(collector.collectionTimeMs)}
                    </td>
                    <td className={`py-2 px-3 text-right font-medium ${
                      avgTime > 100 ? 'text-red-600 dark:text-red-400' :
                      avgTime > 50 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {formatDuration(avgTime)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(!latestSnapshot || latestSnapshot.gc.collectors.length === 0) && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          暂无 GC 数据
        </div>
      )}
    </div>
  );
};
