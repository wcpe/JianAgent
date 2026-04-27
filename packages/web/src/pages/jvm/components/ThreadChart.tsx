import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import type { MonitoringSnapshot } from '../../../hooks/useJvmMonitoring';

interface ThreadChartProps {
  snapshots: MonitoringSnapshot[];
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const ThreadChart: React.FC<ThreadChartProps> = ({ snapshots }) => {
  const chartData = useMemo(() => {
    return snapshots.map((snapshot) => ({
      timestamp: snapshot.timestamp,
      time: formatTime(snapshot.timestamp),
      totalThreads: snapshot.threads.totalThreads,
      daemonThreads: snapshot.threads.daemonThreads,
      runnable: snapshot.threads.stateDistribution.RUNNABLE,
      waiting: snapshot.threads.stateDistribution.WAITING,
      timedWaiting: snapshot.threads.stateDistribution.TIMED_WAITING,
      blocked: snapshot.threads.stateDistribution.BLOCKED,
      hasDeadlock: snapshot.threads.deadlockedThreads.length > 0,
    }));
  }, [snapshots]);

  const latestData = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">线程状态趋势</h3>
        {latestData && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">总线程数:</span>
              <div className="font-semibold text-blue-600 dark:text-blue-400">
                {latestData.totalThreads}
              </div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">运行中:</span>
              <div className="font-semibold text-green-600 dark:text-green-400">
                {latestData.runnable}
              </div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">等待:</span>
              <div className="font-semibold text-yellow-600 dark:text-yellow-400">
                {latestData.waiting}
              </div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">阻塞:</span>
              <div className="font-semibold text-red-600 dark:text-red-400">
                {latestData.blocked}
              </div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">守护线程:</span>
              <div className="font-semibold text-gray-700 dark:text-gray-300">
                {latestData.daemonThreads}
              </div>
            </div>
          </div>
        )}
        
        {latestSnapshot && latestSnapshot.threads.deadlockedThreads.length > 0 && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold">检测到死锁！</span>
            </div>
            <div className="mt-2 text-sm text-red-600 dark:text-red-300">
              死锁线程: {latestSnapshot.threads.deadlockedThreads.join(', ')}
            </div>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
          <XAxis 
            dataKey="time" 
            stroke="#6B7280"
            tick={{ fill: '#6B7280', fontSize: 12 }}
          />
          <YAxis 
            stroke="#6B7280"
            tick={{ fill: '#6B7280', fontSize: 12 }}
            label={{ value: '线程数', angle: -90, position: 'insideLeft', fill: '#6B7280' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1F2937', 
              border: '1px solid #374151',
              borderRadius: '0.375rem',
              color: '#F9FAFB'
            }}
          />
          <Legend />
          <Area 
            type="monotone" 
            dataKey="runnable" 
            stackId="1"
            stroke="#10B981" 
            fill="#10B981"
            name="运行中"
            fillOpacity={0.6}
          />
          <Area 
            type="monotone" 
            dataKey="waiting" 
            stackId="1"
            stroke="#F59E0B" 
            fill="#F59E0B"
            name="等待"
            fillOpacity={0.6}
          />
          <Area 
            type="monotone" 
            dataKey="timedWaiting" 
            stackId="1"
            stroke="#3B82F6" 
            fill="#3B82F6"
            name="定时等待"
            fillOpacity={0.6}
          />
          <Area 
            type="monotone" 
            dataKey="blocked" 
            stackId="1"
            stroke="#EF4444" 
            fill="#EF4444"
            name="阻塞"
            fillOpacity={0.6}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
