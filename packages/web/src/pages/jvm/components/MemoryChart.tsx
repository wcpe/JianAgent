import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { MonitoringSnapshot } from '../../../hooks/useJvmMonitoring';

interface MemoryChartProps {
  snapshots: MonitoringSnapshot[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const MemoryChart: React.FC<MemoryChartProps> = ({ snapshots }) => {
  const chartData = useMemo(() => {
    return snapshots.map((snapshot) => ({
      timestamp: snapshot.timestamp,
      time: formatTime(snapshot.timestamp),
      heapUsed: snapshot.memory.used / (1024 * 1024), // Convert to MB
      heapMax: snapshot.memory.max / (1024 * 1024),
      heapCommitted: snapshot.memory.committed / (1024 * 1024),
      nonHeapUsed: snapshot.memory.nonHeap.used / (1024 * 1024),
      usagePercent: snapshot.memory.usagePercent,
    }));
  }, [snapshots]);

  const latestData = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">内存使用趋势</h3>
        {latestData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">堆内存使用:</span>
              <div className="font-semibold text-blue-600 dark:text-blue-400">
                {latestData.heapUsed.toFixed(2)} MB
              </div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">堆内存最大:</span>
              <div className="font-semibold text-gray-700 dark:text-gray-300">
                {latestData.heapMax.toFixed(2)} MB
              </div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">非堆内存:</span>
              <div className="font-semibold text-green-600 dark:text-green-400">
                {latestData.nonHeapUsed.toFixed(2)} MB
              </div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">使用率:</span>
              <div className={`font-semibold ${
                latestData.usagePercent > 80 ? 'text-red-600 dark:text-red-400' :
                latestData.usagePercent > 60 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-green-600 dark:text-green-400'
              }`}>
                {latestData.usagePercent.toFixed(1)}%
              </div>
            </div>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
          <XAxis 
            dataKey="time" 
            stroke="#6B7280"
            tick={{ fill: '#6B7280', fontSize: 12 }}
          />
          <YAxis 
            stroke="#6B7280"
            tick={{ fill: '#6B7280', fontSize: 12 }}
            label={{ value: 'MB', angle: -90, position: 'insideLeft', fill: '#6B7280' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1F2937', 
              border: '1px solid #374151',
              borderRadius: '0.375rem',
              color: '#F9FAFB'
            }}
            formatter={(value) => {
              if (value === undefined || value === null) return '0 MB';
              const numValue = typeof value === 'number' ? value : 0;
              return `${numValue.toFixed(2)} MB`;
            }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="heapUsed" 
            stroke="#3B82F6" 
            name="堆内存使用"
            strokeWidth={2}
            dot={false}
          />
          <Line 
            type="monotone" 
            dataKey="heapMax" 
            stroke="#9CA3AF" 
            name="堆内存最大"
            strokeWidth={1}
            strokeDasharray="5 5"
            dot={false}
          />
          <Line 
            type="monotone" 
            dataKey="nonHeapUsed" 
            stroke="#10B981" 
            name="非堆内存"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
