import { useState, useRef, useEffect } from 'react';
import { probeApi } from '../api/probe.api.js';
import { useProbeStore } from '../stores/probe.store.js';

interface Props {
  readonly serverId: string;
}

const EXAMPLE_SCRIPTS = [
  { label: '在线玩家数', script: 'server.getOnlinePlayers().size()' },
  { label: '服务器 TPS', script: 'server.getTPS()[0]' },
  { label: '世界列表', script: 'server.getWorlds().stream().map(function(w) { return w.getName() }).toArray()' },
  { label: '已加载区块', script: 'var total = 0; server.getWorlds().forEach(function(w) { total += w.getLoadedChunks().length }); total' },
] as const;

export function ProbeScriptEditor({ serverId }: Props) {
  const [script, setScript] = useState('');
  const [sending, setSending] = useState(false);
  const { evalResults, clearEvalResults } = useProbeStore();
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [evalResults]);

  const handleEval = async () => {
    const code = script.trim();
    if (!code) return;
    setSending(true);
    try {
      await probeApi.evalScript(serverId, code);
    } catch {
      // error handled by result callback
    } finally {
      setSending(false);
    }
  };

  const handleInsertExample = (code: string) => {
    setScript(code);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded p-4 bg-white dark:bg-gray-800/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">JS 脚本执行</h3>
        {evalResults.length > 0 && (
          <button
            onClick={clearEvalResults}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            清空结果
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {EXAMPLE_SCRIPTS.map((ex) => (
          <button
            key={ex.label}
            onClick={() => handleInsertExample(ex.script)}
            className="px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          >
            {ex.label}
          </button>
        ))}
      </div>

      <textarea
        value={script}
        onChange={(e) => setScript(e.target.value)}
        placeholder="输入 JavaScript 代码 — 可访问 server, Bukkit, onlinePlayers, worlds 等对象"
        rows={4}
        className="w-full bg-gray-900 text-green-400 border border-gray-700 rounded p-2 mb-3 text-xs font-mono resize-y scrollbar-slim"
        disabled={sending}
      />

      <div className="flex gap-2 mb-3">
        <button
          onClick={handleEval}
          disabled={sending || !script.trim()}
          className="px-4 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
        >
          执行
        </button>
        <button
          onClick={() => setScript('')}
          className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          清空
        </button>
      </div>

      <div
        ref={logRef}
        className="bg-gray-900 rounded p-2 h-32 overflow-y-auto font-mono text-xs scrollbar-slim"
      >
        {evalResults.length === 0 ? (
          <p className="text-gray-500">脚本执行结果将显示在此处…</p>
        ) : (
          evalResults.map((r) => (
            <div key={r.requestId} className="mb-1">
              <span className="text-gray-500">[{new Date(r.timestamp).toLocaleTimeString()}] </span>
              <span className={r.success ? 'text-cyan-400' : 'text-red-400'}>
                {r.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
