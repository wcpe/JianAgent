import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Send, History } from 'lucide-react';
import type { CommandHistoryHook } from '../hooks/useCommandHistory.js';

interface CommandInputProps {
  readonly onSubmit: (command: string) => void;
  readonly disabled?: boolean;
  readonly history: CommandHistoryHook;
  readonly placeholder?: string;
}

export function CommandInput({ onSubmit, disabled, history, placeholder }: CommandInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [showHistory, setShowHistory] = useState(false);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || disabled) return;

    onSubmit(trimmed);
    history.addCommand(trimmed);
    setInput('');
    history.reset();
  }, [input, disabled, onSubmit, history]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const cmd = history.navigateUp();
      if (cmd !== null) {
        setInput(cmd);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const cmd = history.navigateDown();
      if (cmd !== null) {
        setInput(cmd);
      } else {
        setInput('');
      }
    }
  }, [history]);

  const handleHistoryClick = useCallback((cmd: string) => {
    setInput(cmd);
    setShowHistory(false);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder ?? 'arthas> 输入命令 (如: dashboard, thread, jvm)'}
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-green-400 font-mono placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          disabled={disabled || history.history.length === 0}
          className="p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="命令历史"
        >
          <History className="w-5 h-5" />
        </button>
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="p-2.5 bg-indigo-600 border border-indigo-500 rounded-lg text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="执行命令"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>

      {showHistory && history.history.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto z-10">
          <div className="p-2 border-b border-gray-700">
            <span className="text-xs text-gray-400 font-medium">命令历史</span>
          </div>
          <div className="p-1">
            {[...history.history].reverse().map((cmd, idx) => (
              <button
                key={idx}
                onClick={() => handleHistoryClick(cmd)}
                className="w-full px-3 py-2 text-left text-sm text-gray-300 font-mono hover:bg-gray-700 rounded transition-colors"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
