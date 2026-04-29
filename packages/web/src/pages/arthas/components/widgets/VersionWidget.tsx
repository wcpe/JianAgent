import React from 'react';

interface VersionWidgetProps {
  readonly data: { version?: string };
}

export function VersionWidget({ data }: VersionWidgetProps) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
      <div className="text-xs text-gray-400">Arthas 版本</div>
      <div className="mt-1 text-lg font-semibold text-white">{data.version ?? 'unknown'}</div>
    </div>
  );
}
