import React from 'react';
import { Circle, Loader2, AlertCircle } from 'lucide-react';
import type { ConnectionState } from '../hooks/useArthasConnection.js';

interface StatusIndicatorProps {
  readonly state: ConnectionState;
  readonly error?: string | null;
}

const STATE_CONFIG: Record<ConnectionState, { icon: React.ReactNode; label: string; color: string }> = {
  disconnected: {
    icon: <Circle className="w-4 h-4" />,
    label: '未连接',
    color: 'text-gray-400',
  },
  connecting: {
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    label: '连接中...',
    color: 'text-yellow-400',
  },
  connected: {
    icon: <Circle className="w-4 h-4 fill-green-500" />,
    label: '已连接',
    color: 'text-green-400',
  },
  error: {
    icon: <AlertCircle className="w-4 h-4" />,
    label: '连接错误',
    color: 'text-red-400',
  },
};

export function StatusIndicator({ state, error }: StatusIndicatorProps) {
  const config = STATE_CONFIG[state];

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg border border-gray-700">
      <span className={config.color}>{config.icon}</span>
      <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
      {error && state === 'error' && (
        <span className="text-xs text-red-400 ml-2" title={error}>
          {error.slice(0, 30)}...
        </span>
      )}
    </div>
  );
}
