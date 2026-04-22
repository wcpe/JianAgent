import { type FC, useState, useCallback, useRef, useEffect } from 'react';

interface SearchCallbacks {
  findNext(query: string, options?: { caseSensitive?: boolean; regex?: boolean }): void;
  findPrevious(query: string, options?: { caseSensitive?: boolean; regex?: boolean }): void;
  clearDecorations?(): void;
}

interface Props {
  readonly searchCallbacks: SearchCallbacks | null;
  readonly visible: boolean;
  readonly onClose: () => void;
}

const SearchBar: FC<Props> = ({ searchCallbacks, visible, onClose }) => {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regex, setRegex] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [visible]);

  const handleNext = useCallback(() => {
    if (!searchCallbacks || !query) return;
    searchCallbacks.findNext(query, { caseSensitive, regex });
  }, [searchCallbacks, query, caseSensitive, regex]);

  const handlePrev = useCallback(() => {
    if (!searchCallbacks || !query) return;
    searchCallbacks.findPrevious(query, { caseSensitive, regex });
  }, [searchCallbacks, query, caseSensitive, regex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          handlePrev();
        } else {
          handleNext();
        }
      }
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleNext, handlePrev, onClose],
  );

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setMatchCount(null);
    },
    [],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setMatchCount(null);
    searchCallbacks?.clearDecorations?.();
    inputRef.current?.focus();
  }, [searchCallbacks]);

  if (!visible) return null;

  return (
    <div className="absolute top-2 right-2 z-50 flex items-center gap-1 bg-gray-800 border border-gray-600 rounded-md px-2 py-1 shadow-lg">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleQueryChange}
        onKeyDown={handleKeyDown}
        placeholder="搜索…"
        className="bg-transparent text-white text-sm outline-none w-48 placeholder-gray-500"
      />

      {matchCount !== null && (
        <span className="text-xs text-gray-400 mr-1">{matchCount}</span>
      )}

      {/* Case sensitive toggle */}
      <button
        type="button"
        onClick={() => setCaseSensitive((v) => !v)}
        className={`px-1.5 py-0.5 text-xs rounded ${
          caseSensitive
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-white'
        }`}
        title="区分大小写"
      >
        Aa
      </button>

      {/* Regex toggle */}
      <button
        type="button"
        onClick={() => setRegex((v) => !v)}
        className={`px-1.5 py-0.5 text-xs rounded ${
          regex
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-white'
        }`}
        title="正则表达式"
      >
        .*
      </button>

      {/* Previous */}
      <button
        type="button"
        onClick={handlePrev}
        className="text-gray-400 hover:text-white px-1"
        title="上一个 (Shift+Enter)"
      >
        ↑
      </button>

      {/* Next */}
      <button
        type="button"
        onClick={handleNext}
        className="text-gray-400 hover:text-white px-1"
        title="下一个 (Enter)"
      >
        ↓
      </button>

      {/* Clear */}
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="text-gray-400 hover:text-white px-1"
          title="清除"
        >
          ×
        </button>
      )}

      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="text-gray-400 hover:text-white px-1 ml-1"
        title="关闭 (Esc)"
      >
        ✕
      </button>
    </div>
  );
};

export default SearchBar;
