import { useEffect, useState } from 'react';
import { serverApi } from '../../api/server.api.js';

interface ServerLogPreviewProps {
  readonly serverId: string;
}

export function ServerLogPreview({ serverId }: ServerLogPreviewProps) {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    serverApi.getServer(serverId).then(() => {
      // Attempt to fetch recent logs; silently fallback if endpoint unavailable
      fetch(`/api/servers/${encodeURIComponent(serverId)}/logs/recent?lines=5`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data: string[]) => setLines(Array.isArray(data) ? data.slice(-5) : []))
        .catch(() => setLines([]));
    }).catch(() => {});
  }, [serverId]);

  if (lines.length === 0) {
    return <p className="text-xs text-gray-400 italic">暂无日志</p>;
  }

  return (
    <pre className="text-[11px] leading-tight text-gray-600 bg-gray-50 rounded p-1.5 max-h-20 overflow-hidden font-mono">
      {lines.join('\n')}
    </pre>
  );
}
