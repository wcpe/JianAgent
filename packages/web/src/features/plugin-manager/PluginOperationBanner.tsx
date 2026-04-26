/**
 * PluginOperationBanner
 *
 * Displays recent plugin operation results as dismissable banners.
 * Shows success/failure with operation type and plugin name.
 */

import React from 'react';
import { usePluginOperationStore } from './plugin-operation.store.js';
import type { PluginOperationType } from '@jian-agent/shared-domain';

interface PluginOperationBannerProps {
  readonly serverId: string;
}

const OPERATION_LABELS: Record<PluginOperationType, string> = {
  'enable': '启用',
  'disable': '禁用',
  'hot-load': '热加载',
  'hot-unload': '热卸载',
  'hot-reload': '热重载',
  'replace-version': '替换版本',
};

function getTrackLabel(operation: PluginOperationType): { label: string; track: 'file' | 'hot' } {
  switch (operation) {
    case 'enable':
    case 'disable':
      return { label: OPERATION_LABELS[operation], track: 'file' };
    case 'hot-load':
    case 'hot-unload':
    case 'hot-reload':
      return { label: OPERATION_LABELS[operation], track: 'hot' };
    case 'replace-version':
      return { label: OPERATION_LABELS[operation], track: 'file' };
  }
}

export function PluginOperationBanner({ serverId }: PluginOperationBannerProps) {
  const allEntries = usePluginOperationStore((s) => s.entries);
  const entries = React.useMemo(() => {
    return Object.values(allEntries)
      .filter((e) => e.serverId === serverId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [allEntries, serverId]);
  
  const dismiss = usePluginOperationStore((s) => s.dismiss);

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 mb-2">
      {entries.map((entry) => {
        const { label, track } = getTrackLabel(entry.operation);
        return (
          <div
            key={entry.requestId}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
              entry.success
                ? 'bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-700/40 text-success-700 dark:text-success-400'
                : 'bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-700/40 text-danger-700 dark:text-danger-400'
            }`}
          >
            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
              track === 'hot'
                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            }`}>
              {track === 'hot' ? '热轨' : '文件轨'}
            </span>
            <span className="font-medium">{label}</span>
            <span className="text-gray-500 dark:text-gray-400">{entry.pluginName}</span>
            <span className="flex-1 text-gray-400 dark:text-gray-500 truncate">{entry.message}</span>
            {!entry.hasConnection && entry.operation !== 'enable' && entry.operation !== 'disable' && (
              <span className="text-warning-600 dark:text-warning-400 text-[10px]">无连接</span>
            )}
            <button
              onClick={() => dismiss(entry.requestId)}
              className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
