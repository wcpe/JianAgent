import { useState, useRef, useEffect } from 'react';
import { probeApi } from '../api/probe.api.js';
import { useProbeStore } from '../stores/probe.store.js';

interface Props {
  readonly serverId: string;
}

export function ProbeConsolePanel({ serverId }: Props) {
  const [command, setCommand] = useState('');
  const [sending, setSending] = useState(false);
  const { consoleResults, clearConsoleResults } = useProbeStore();
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [consoleResults]);

  const handleSend = async () => {
    const cmd = command.trim();
    if (!cmd) return;
    setSending(true);
    try {
      await probeApi.executeConsole(serverId, cmd);
      setCommand('');
    } catch (e) {
      // error will be shown via toast if needed
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded p-4 bg-white dark:bg-gray-800/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">控制台命令</h3>
        {consoleResults.length > 0 && (
          <button
            onClick={clearConsoleResults}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            清空
          </button>
        )}
      </div>

      <div
        ref={logRef}
        className="bg-gray-900 rounded p-2 mb-3 h-40 overflow-y-auto font-mono text-xs scrollbar-slim"
      >
        {consoleResults.length === 0 ? (
          <p className="text-gray-500">输入命令后结果将显示在此处…</p>
        ) : (
          consoleResults.map((r) => (
            <div key={r.requestId} className="mb-1">
              <span className="text-gray-500">[{new Date(r.timestamp).toLocaleTimeString()}] </span>
              <span className={r.success ? 'text-green-400' : 'text-red-400'}>
                {r.message}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入 Bukkit 命令，如 list、tps、gc…"
          className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded px-3 py-1.5 text-sm font-mono"
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={sending || !command.trim()}
          className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          发送
        </button>
      </div>
    </div>
  );
}
