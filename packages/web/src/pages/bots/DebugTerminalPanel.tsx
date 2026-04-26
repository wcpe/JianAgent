import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Terminal,
  Search,
  Copy,
  Trash2,
  X,
} from 'lucide-react';

/** Colorize a debug output line */
function getLineStyle(line: string): string {
  if (line.startsWith('[ERROR]') || line.includes('Error') || line.includes('error'))
    return 'text-danger-400';
  if (line.startsWith('[WARN]') || line.includes('warn'))
    return 'text-warning-400';
  if (line.startsWith('>') || line.startsWith('[CMD]'))
    return 'text-success-400';
  if (line.startsWith('[INFO]') || line.includes('info'))
    return 'text-info-400';
  if (line.startsWith('[CHAT]') || line.includes('<'))
    return 'text-cyan-300';
  return 'text-gray-300';
}

interface DebugTerminalPanelProps {
  readonly debugLines: readonly string[];
  readonly debugActive: boolean;
  readonly sendCommand: (cmd: string) => Promise<void>;
  readonly setDebugLines: React.Dispatch<React.SetStateAction<readonly string[]>>;
  readonly showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function DebugTerminalPanel({
  debugLines,
  debugActive,
  sendCommand,
  setDebugLines,
  showToast,
}: DebugTerminalPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cmdInput, setCmdInput] = useState('');
  const [outputFilter, setOutputFilter] = useState('');
  const [showOutputFilter, setShowOutputFilter] = useState(false);

  // Command history
  const cmdHistoryRef = useRef<string[]>([]);
  const cmdHistoryIndex = useRef(-1);

  // Scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [debugLines]);

  // Filtered lines
  const filteredLines = useMemo(() => {
    if (!outputFilter.trim()) return debugLines;
    const lower = outputFilter.toLowerCase();
    return debugLines.filter((line) => line.toLowerCase().includes(lower));
  }, [debugLines, outputFilter]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const history = cmdHistoryRef.current;
      if (history.length === 0) return;
      const idx = cmdHistoryIndex.current === -1 ? history.length - 1 : Math.max(0, cmdHistoryIndex.current - 1);
      cmdHistoryIndex.current = idx;
      setCmdInput(history[idx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const history = cmdHistoryRef.current;
      if (cmdHistoryIndex.current === -1) return;
      const idx = cmdHistoryIndex.current + 1;
      if (idx >= history.length) {
        cmdHistoryIndex.current = -1;
        setCmdInput('');
      } else {
        cmdHistoryIndex.current = idx;
        setCmdInput(history[idx]);
      }
    } else if (e.key === 'Enter') {
      const text = cmdInput.trim();
      if (!text) return;
      // Track history
      const history = cmdHistoryRef.current;
      if (history[history.length - 1] !== text) {
        history.push(text);
        if (history.length > 100) history.shift();
      }
      cmdHistoryIndex.current = -1;

      if (text.startsWith('/')) {
        sendCommand(`.cmd ${text.slice(1)}`);
      } else if (text.startsWith('.')) {
        sendCommand(text);
      } else {
        sendCommand(`.chat ${text}`);
      }
      setCmdInput('');
    }
  }, [cmdInput, sendCommand]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-gray-400 text-xs border-b border-gray-700">
        <Terminal className="w-3.5 h-3.5" />
        <span>调试输出</span>
        <span className="text-gray-600 ml-1">({debugLines.length})</span>
        {debugActive && <span className="text-success-400 ml-1">已连接</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setShowOutputFilter((v) => !v)}
            className={`p-1 rounded hover:bg-gray-700 transition-colors ${showOutputFilter ? 'text-info-400' : 'text-gray-500'}`}
            title="搜索输出 (Ctrl+F)"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              const text = debugLines.join('\n');
              navigator.clipboard.writeText(text).then(() => showToast('已复制到剪贴板', 'success'));
            }}
            className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
            title="复制全部输出"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDebugLines([])}
            className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-danger-400 transition-colors"
            title="清空输出"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {/* Output filter bar */}
      {showOutputFilter && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-850 border-b border-gray-700">
          <Search className="w-3 h-3 text-gray-500" />
          <input
            type="text"
            placeholder="过滤输出..."
            value={outputFilter}
            onChange={(e) => setOutputFilter(e.target.value)}
            className="flex-1 bg-transparent text-gray-300 text-xs outline-none placeholder-gray-600 font-mono"
            autoFocus
          />
          {outputFilter && (
            <>
              <span className="text-[10px] text-gray-500">{filteredLines.length}/{debugLines.length}</span>
              <button onClick={() => setOutputFilter('')} className="text-gray-500 hover:text-gray-300">
                <X className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      )}
      <div ref={scrollRef} className="flex-1 bg-gray-950 overflow-y-auto p-3 font-mono text-xs leading-5">
        {filteredLines.map((line, i) => (
          <div key={i} className={`whitespace-pre-wrap break-all ${getLineStyle(line)}`}>{line}</div>
        ))}
        {debugLines.length === 0 && (
          <span className="text-gray-600">等待调试输出...</span>
        )}
      </div>

      {/* Command input with history */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border-t border-gray-700">
        <span className="text-success-400 text-xs font-mono">{'>'}</span>
        <input
          type="text"
          placeholder="输入命令 (↑↓ 历史, 不带/发言, 带/游戏命令, .内部命令)"
          value={cmdInput}
          onChange={(e) => setCmdInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-gray-200 text-sm outline-none placeholder-gray-600 font-mono"
        />
      </div>
    </div>
  );
}
