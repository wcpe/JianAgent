import { useState } from 'react';
import { probeApi } from '../api/probe.api.js';

interface Props {
  readonly serverId: string;
}

const ACTIONS = [
  { id: 'teleport', label: '传送' },
  { id: 'force-start', label: '强制开始' },
  { id: 'stop-game', label: '停止游戏' },
  { id: 'snapshot', label: '获取快照' },
] as const;

export function CommandPanel({ serverId }: Props) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSend = async (action: string) => {
    setSending(true);
    setResult(null);
    try {
      const res = await probeApi.sendCommand(serverId, action);
      setResult(res.sent ? '已发送' : '发送失败');
    } catch (e) {
      setResult(`错误: ${String(e)}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded p-4 bg-white dark:bg-gray-800/50">
      <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">白名单命令</h3>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            disabled={sending}
            onClick={() => handleSend(a.id)}
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {a.label}
          </button>
        ))}
      </div>
      {result && <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">{result}</p>}
    </div>
  );
}
