import { useState, useCallback, useRef } from 'react';

const MAX_HISTORY_SIZE = 100;

export interface CommandHistoryHook {
  readonly history: readonly string[];
  readonly currentIndex: number;
  addCommand: (command: string) => void;
  navigateUp: () => string | null;
  navigateDown: () => string | null;
  reset: () => void;
  clear: () => void;
}

export function useCommandHistory(): CommandHistoryHook {
  const [history, setHistory] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const tempInputRef = useRef<string>('');

  const addCommand = useCallback((command: string) => {
    const trimmed = command.trim();
    if (!trimmed) return;

    setHistory((prev) => {
      const filtered = prev.filter((cmd) => cmd !== trimmed);
      const updated = [...filtered, trimmed];
      return updated.slice(-MAX_HISTORY_SIZE);
    });
    setCurrentIndex(-1);
    tempInputRef.current = '';
  }, []);

  const navigateUp = useCallback((): string | null => {
    if (history.length === 0) return null;

    setCurrentIndex((prev) => {
      const newIndex = prev === -1 ? history.length - 1 : Math.max(0, prev - 1);
      return newIndex;
    });

    const newIndex = currentIndex === -1 ? history.length - 1 : Math.max(0, currentIndex - 1);
    return history[newIndex] ?? null;
  }, [history, currentIndex]);

  const navigateDown = useCallback((): string | null => {
    if (currentIndex === -1) return null;

    const newIndex = currentIndex + 1;
    if (newIndex >= history.length) {
      setCurrentIndex(-1);
      return tempInputRef.current;
    }

    setCurrentIndex(newIndex);
    return history[newIndex] ?? null;
  }, [history, currentIndex]);

  const reset = useCallback(() => {
    setCurrentIndex(-1);
    tempInputRef.current = '';
  }, []);

  const clear = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
    tempInputRef.current = '';
  }, []);

  return {
    history,
    currentIndex,
    addCommand,
    navigateUp,
    navigateDown,
    reset,
    clear,
  };
}
