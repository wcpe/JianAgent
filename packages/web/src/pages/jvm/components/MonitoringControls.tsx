import React from 'react';
import { Play, Square, Activity, Clock, AlertCircle } from 'lucide-react';
import type { ConnectionState } from '../../../hooks/useJvmMonitoring';

interface MonitoringControlsProps {
  connectionState: ConnectionState;
  interval: number;
  onIntervalChange: (interval: number) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  error: string | null;
}

const INTERVAL_OPTIONS = [
  { value: 1, label: '1 秒' },
  { value: 5, label: '5 秒' },
  { value: 10, label: '10 秒' },
  { value: 30, label: '30 秒' },
];

export const MonitoringControls: React.FC<MonitoringControlsProps> = ({
  connectionState,
  interval,
  onIntervalChange,
  onConnect,
  onDisconnect,
  error,
}) => {
  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Left: Connection Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity className={`w-5 h-5 ${
              isConnected ? 'text-green-500' : 
              isConnecting ? 'text-yellow-500' : 
              connectionState === 'error' ? 'text-red-500' : 
              'text-gray-400'
            }`} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {isConnected ? '监控中' : 
               isConnecting ? '连接中...' : 
               connectionState === 'error' ? '连接错误' : 
               '未连接'}
            </span>
          </div>
          
          {error && (
            <div className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-3">
          {/* Interval Selector */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <label className="text-sm text-gray-600 dark:text-gray-400">采样间隔:</label>
            <select
              value={interval}
              onChange={(e) => onIntervalChange(Number(e.target.value))}
              disabled={isConnected}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {INTERVAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Start/Stop Button */}
          {!isConnected ? (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md transition-colors text-sm font-medium"
            >
              <Play className="w-4 h-4" />
              {isConnecting ? '连接中...' : '开始监控'}
            </button>
          ) : (
            <button
              onClick={onDisconnect}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors text-sm font-medium"
            >
              <Square className="w-4 h-4" />
              停止监控
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
