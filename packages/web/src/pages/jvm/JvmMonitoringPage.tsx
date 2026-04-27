import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity } from 'lucide-react';
import { useJvmMonitoring } from '../../hooks/useJvmMonitoring';
import { MonitoringControls } from './components/MonitoringControls';
import { MemoryChart } from './components/MemoryChart';
import { ThreadChart } from './components/ThreadChart';
import { GcEventList } from './components/GcEventList';

export const JvmMonitoringPage: React.FC = () => {
  const { pid } = useParams<{ pid: string }>();
  const navigate = useNavigate();
  const [interval, setInterval] = useState(5);

  if (!pid) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-600">错误: 缺少 PID 参数</div>
      </div>
    );
  }

  const {
    connectionState,
    snapshots,
    error,
    connect,
    disconnect,
    setInterval: updateInterval,
  } = useJvmMonitoring({
    pid,
    interval,
    maxDataPoints: 100,
    autoConnect: false,
  });

  const handleIntervalChange = (newInterval: number) => {
    setInterval(newInterval);
    updateInterval(newInterval);
  };

  const handleBack = () => {
    navigate('/jvm');
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            title="返回进程列表"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-blue-500" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                JVM 实时监控
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                进程 PID: {pid}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Controls */}
          <MonitoringControls
            connectionState={connectionState}
            interval={interval}
            onIntervalChange={handleIntervalChange}
            onConnect={connect}
            onDisconnect={disconnect}
            error={error}
          />

          {/* Charts Grid */}
          {snapshots.length > 0 ? (
            <div className="space-y-6">
              {/* Memory Chart */}
              <MemoryChart snapshots={snapshots} />

              {/* Thread Chart */}
              <ThreadChart snapshots={snapshots} />

              {/* GC Event List */}
              <GcEventList snapshots={snapshots} />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center border border-gray-200 dark:border-gray-700">
              <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                暂无监控数据
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                点击"开始监控"按钮开始收集 JVM 监控数据
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JvmMonitoringPage;
