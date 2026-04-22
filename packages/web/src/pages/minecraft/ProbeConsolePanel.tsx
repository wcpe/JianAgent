import { useState, useCallback, useRef, useEffect } from 'react';
import { probeApi } from '../../api/probe.api.js';

interface ProbeConsolePanelProps {
  serverId: string;
  connected: boolean;
}

interface ConsoleEntry {
  id: string;
  type: 'command' | 'response' | 'error';
  content: string;
  timestamp: Date;
}

let entryId = 0;
const nextId = () => `entry-${++entryId}`;

export function ProbeConsolePanel({ serverId, connected }: ProbeConsolePanelProps) {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<ConsoleEntry[]>([]);
  const [sending, setSending] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [history, scrollToBottom]);

  const addEntry = useCallback((type: ConsoleEntry['type'], content: string) => {
    setHistory((prev) => [
      ...prev,
      { id: nextId(), type, content, timestamp: new Date() },
    ]);
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = command.trim();
    if (!trimmed || !connected) return;

    addEntry('command', `> ${trimmed}`);
    setCommandHistory((prev) => [trimmed, ...prev].slice(0, 100));
    setHistoryIndex(-1);
    setCommand('');
    setSending(true);

    try {
      const res = await probeApi.executeConsole(serverId, trimmed);
      if (res.sent) {
        addEntry('response', `[${res.requestId}] 命令已发送`);
      } else {
        addEntry('error', '命令发送失败');
      }
    } catch (err) {
      addEntry('error', err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [command, connected, serverId, addEntry]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCommandHistory((prev) => {
          if (prev.length === 0) return prev;
          const newIndex = Math.min(historyIndex + 1, prev.length - 1);
          setHistoryIndex(newIndex);
          setCommand(prev[newIndex] ?? '');
          return prev;
        });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCommandHistory((prev) => {
          if (historyIndex <= 0) {
            setHistoryIndex(-1);
            setCommand('');
            return prev;
          }
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setCommand(prev[newIndex] ?? '');
          return prev;
        });
      }
    },
    [handleSend, historyIndex],
  );

  const handleClear = useCallback(() => {
    setHistory([]);
  }, []);

  const handleQuickCommand = useCallback(
    (cmd: string) => {
      setCommand(cmd);
      inputRef.current?.focus();
    },
    [],
  );

  const quickCommands = [
    { label: 'list', cmd: 'list' },
    { label: 'tps', cmd: 'tps' },
    { label: 'timings', cmd: 'timings report' },
    { label: 'gc', cmd: 'gc' },
    { label: 'plugins', cmd: 'plugins' },
    { label: 'version', cmd: 'version' },
  ];

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800/50">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">探针控制台</h2>
        <div className="flex gap-2">
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            清空
          </button>
        </div>
      </div>

      {/* Quick Commands */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {quickCommands.map((qc) => (
          <button
            key={qc.cmd}
            onClick={() => handleQuickCommand(qc.cmd)}
            disabled={!connected}
            className="px-2 py-1 text-xs font-mono text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded hover:bg-primary-100 dark:hover:bg-primary-900/40 disabled:opacity-50 transition-colors"
          >
            {qc.label}
          </button>
        ))}
      </div>

      {/* Console Output */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-900 dark:bg-black p-3 font-mono text-xs h-64 overflow-y-auto mb-3">
        {history.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-600 text-center py-4">
            {connected ? '输入命令与服务器交互...' : '等待探针连接...'}
          </div>
        ) : (
          history.map((entry) => (
            <div
              key={entry.id}
              className={`py-0.5 ${
                entry.type === 'command'
                  ? 'text-green-400'
                  : entry.type === 'error'
                    ? 'text-red-400'
                    : 'text-gray-300 dark:text-gray-400'
              }`}
            >
              <span className="text-gray-600 dark:text-gray-700 mr-2 select-none">
                [{entry.timestamp.toLocaleTimeString()}]
              </span>
              {entry.content}
            </div>
          ))
        )}
        <div ref={consoleEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 overflow-hidden">
          <span className="pl-3 text-gray-400 dark:text-gray-500 font-mono text-sm select-none">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!connected}
            placeholder={connected ? '输入 Minecraft 控制台命令...' : '探针未连接'}
            className="flex-1 px-2 py-2 text-sm font-mono bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none disabled:opacity-50"
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!connected || sending || !command.trim()}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {sending ? '发送中…' : '发送'}
        </button>
      </div>
    </section>
  );
}
