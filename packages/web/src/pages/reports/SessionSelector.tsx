import { type FC, useEffect, useState } from 'react';
import { apiFetch } from '../../api/client.js';
import type { SessionSummary } from '@jian-agent/shared-domain';

interface Props {
  readonly onSelect: (sessionId: string) => void;
  readonly selectedId: string | null;
  readonly multi?: boolean;
}

export const SessionSelector: FC<Props> = ({ onSelect, selectedId, multi }) => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch<SessionSummary[]>('/session?limit=20&sort=desc')
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-zinc-400">加载会话列表...</p>;
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-zinc-500">暂无已完成会话</p>;
  }

  return (
    <div className="space-y-1.5">
      {sessions.map((s) => {
        const isSelected = selectedId === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              isSelected
                ? 'bg-blue-600/20 border border-blue-500 text-blue-300'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-transparent'
            }`}
          >
            <div className="font-mono text-xs">{s.id.slice(0, 8)}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              {new Date(s.startedAt ?? s.createdAt ?? 0).toLocaleString('zh-CN')}
            </div>
          </button>
        );
      })}
    </div>
  );
};
