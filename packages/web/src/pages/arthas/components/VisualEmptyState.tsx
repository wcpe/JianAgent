import React from 'react';

interface VisualEmptyStateProps {
  readonly message?: string;
}

export function VisualEmptyState({ message }: VisualEmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-gray-600 bg-gray-900/40 p-3 text-xs text-gray-500">
      <div className="font-medium text-gray-300">暂无结构化数据</div>
      <div className="mt-1">{message ?? '请先执行命令。'}</div>
    </div>
  );
}
