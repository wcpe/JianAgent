import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { serverApi, type LogFileEntry, type LogSearchResult } from '../../api/server.api.js';
import { wsClient } from '../../ws/ws-client.js';
import { WsChannel } from '@jian-agent/shared-protocol';

interface LogReplayTabProps {
  readonly serverId: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Highlight keywords in a log line, splitting into spans */
function HighlightedLine({ text, highlight }: { readonly text: string; readonly highlight: string }) {
  if (!highlight) return <>{text}</>;
  const parts: Array<{ text: string; match: boolean }> = [];
  const lower = text.toLowerCase();
  const lowerH = highlight.toLowerCase();
  let pos = 0;
  while (pos < text.length) {
    const idx = lower.indexOf(lowerH, pos);
    if (idx === -1) {
      parts.push({ text: text.slice(pos), match: false });
      break;
    }
    if (idx > pos) parts.push({ text: text.slice(pos, idx), match: false });
    parts.push({ text: text.slice(idx, idx + highlight.length), match: true });
    pos = idx + highlight.length;
  }
  return (
    <>
      {parts.map((p, i) =>
        p.match ? (
          <mark key={i} className="bg-yellow-300 dark:bg-yellow-700 text-inherit rounded px-0.5">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

export function LogReplayTab({ serverId }: LogReplayTabProps) {
  // File list state
  const [files, setFiles] = useState<readonly LogFileEntry[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Content state
  const [content, setContent] = useState('');
  const [contentLoading, setContentLoading] = useState(false);

  // Tail mode
  const [tailing, setTailing] = useState(false);
  const tailLinesRef = useRef<string[]>([]);
  const contentEndRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<readonly LogSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState('');

  // Jump-to-line
  const [targetLine, setTargetLine] = useState<number | null>(null);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // ── Load file list ──
  const loadFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const list = await serverApi.listLogFiles(serverId);
      setFiles(list);
    } catch {
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }, [serverId]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  // ── Stop tailing when switching files ──
  const stopTail = useCallback(() => {
    if (tailing) {
      wsClient.send({ channel: WsChannel.RESOURCE_LOG_TAIL_STOP });
      setTailing(false);
      tailLinesRef.current = [];
    }
  }, [tailing]);

  // ── Select and read a file (internal) ──
  const selectFileInternal = useCallback(async (filename: string, jumpToLine?: number) => {
    stopTail();
    setSelectedFile(filename);
    setContentLoading(true);
    setTargetLine(jumpToLine ?? null);
    try {
      const result = await serverApi.tailLogFile(serverId, filename, 1000);
      setContent(result.content);
    } catch {
      setContent('加载失败');
    } finally {
      setContentLoading(false);
    }
  }, [serverId, stopTail]);

  // ── Select file from sidebar (clears search) ──
  const selectFile = useCallback(async (filename: string) => {
    setShowSearch(false);
    setSearchResults([]);
    setActiveHighlight('');
    await selectFileInternal(filename);
  }, [selectFileInternal]);

  // ── Select file from search result (jump to line + keep highlight) ──
  const selectFileFromSearch = useCallback(async (filename: string, line: number) => {
    await selectFileInternal(filename, line);
  }, [selectFileInternal]);

  // ── Auto-load latest.log on first file list load ──
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone.current || files.length === 0 || selectedFile) return;
    initialLoadDone.current = true;
    const latestLog = files.find((f) => f.name === 'latest.log');
    if (latestLog) {
      selectFileInternal('latest.log');
    }
  }, [files, selectedFile, selectFileInternal]);

  // ── Start/stop tail for latest.log ──
  const toggleTail = useCallback(() => {
    if (tailing) {
      stopTail();
      return;
    }
    const filename = selectedFile || 'latest.log';
    if (!selectedFile) {
      setSelectedFile(filename);
    }
    tailLinesRef.current = [];
    setTailing(true);
    wsClient.send({
      channel: WsChannel.RESOURCE_LOG_TAIL_START,
      sessionId: serverId,
      payload: { filename },
    });
  }, [tailing, selectedFile, serverId, stopTail]);

  // ── Listen for tail lines ──
  useEffect(() => {
    if (!tailing) return;
    const removeListener = wsClient.addListener((msg) => {
      if (msg.channel === WsChannel.RESOURCE_LOG_TAIL && msg.sessionId === serverId) {
        const line = (msg.payload as { line: string }).line;
        tailLinesRef.current = [...tailLinesRef.current.slice(-4999), line];
        setContent((prev) => {
          const lines = prev.split('\n');
          const updated = [...lines.slice(-4999), line];
          return updated.join('\n');
        });
      }
    });
    return () => {
      removeListener();
    };
  }, [tailing, serverId]);

  // ── Auto-scroll when tailing ──
  useEffect(() => {
    if (tailing && contentEndRef.current) {
      contentEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [content, tailing]);

  // ── Scroll to target line after content loads ──
  useEffect(() => {
    if (targetLine !== null && !contentLoading) {
      requestAnimationFrame(() => {
        const el = lineRefs.current.get(targetLine);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-yellow-400');
          const timer = setTimeout(() => el.classList.remove('ring-2', 'ring-yellow-400'), 2000);
          return () => clearTimeout(timer);
        }
      });
      setTargetLine(null);
    }
  }, [targetLine, contentLoading]);

  // ── Search ──
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setActiveHighlight(searchQuery.trim());
    try {
      const results = await serverApi.searchLogFiles(serverId, searchQuery.trim());
      setSearchResults(results);
      setShowSearch(true);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [serverId, searchQuery]);

  // ── Cleanup tail on unmount ──
  useEffect(() => {
    return () => {
      wsClient.send({ channel: WsChannel.RESOURCE_LOG_TAIL_STOP });
    };
  }, []);

  // ── Content lines for rendering ──
  const contentLines = useMemo(() => content.split('\n'), [content]);

  return (
    <div className="flex h-full bg-white dark:bg-gray-900">
      {/* Left: File list */}
      <div className="w-60 shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">日志文件</span>
          <button
            onClick={loadFiles}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            刷新
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filesLoading ? (
            <div className="p-3 text-xs text-gray-400">加载中...</div>
          ) : files.length === 0 ? (
            <div className="p-3 text-xs text-gray-400">无日志文件</div>
          ) : (
            files.map((file) => (
              <button
                key={file.name}
                onClick={() => selectFile(file.name)}
                className={`w-full text-left px-3 py-2 text-xs border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  selectedFile === file.name ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px]">{file.isGzipped ? '📦' : '📄'}</span>
                  <span className="font-mono truncate">{file.name}</span>
                </div>
                <div className="flex justify-between mt-0.5 text-[10px] text-gray-400">
                  <span>{formatSize(file.size)}</span>
                  <span>{new Date(file.modifiedAt).toLocaleDateString()}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: Content viewer */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <button
            onClick={toggleTail}
            className={`px-3 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 ${
              tailing
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {tailing ? '⏹ 停止追踪' : '▶ 实时追踪'}
          </button>
          {selectedFile && (
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
              {selectedFile}
            </span>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索日志..."
              className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded px-2 py-1 text-xs w-48"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              {searching ? '搜索中...' : '搜索'}
            </button>
          </div>
        </div>

        {/* Search results panel */}
        {showSearch && (
          <div className="max-h-48 overflow-y-auto border-b border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-yellow-200 dark:border-yellow-800">
              <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
                搜索结果: {searchResults.length} 条匹配
              </span>
              <button
                onClick={() => setShowSearch(false)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ✕ 关闭
              </button>
            </div>
            {searchResults.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400">无匹配结果</div>
            ) : (
              searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => selectFileFromSearch(r.file, r.line)}
                  className="w-full text-left px-3 py-1 text-xs hover:bg-yellow-100 dark:hover:bg-yellow-900/40 border-b border-yellow-100 dark:border-yellow-900/30"
                >
                  <span className="text-yellow-600 dark:text-yellow-400 font-mono mr-2">
                    {r.file}:{r.line}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300 font-mono">{r.content}</span>
                </button>
              ))
            )}
          </div>
        )}

        {/* Log content */}
        <div className="flex-1 overflow-auto p-0 relative z-0">
          {contentLoading ? (
            <div className="flex justify-center py-8 text-gray-400 text-sm">加载中...</div>
          ) : !selectedFile && !tailing ? (
            <div className="flex justify-center py-8 text-gray-400 text-sm">
              选择一个日志文件或点击"实时追踪"
            </div>
          ) : (
            <div className="font-mono text-xs leading-5 min-w-max">
              {contentLines.map((line, i) => (
                <div
                  key={i}
                  ref={(el) => { if (el) lineRefs.current.set(i + 1, el); else lineRefs.current.delete(i + 1); }}
                  className={`px-3 py-0 hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-pre transition-shadow ${
                    line.includes('ERROR') || line.includes('SEVERE')
                      ? 'text-red-500 bg-red-50/50 dark:bg-red-900/20'
                      : line.includes('WARN')
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className="text-gray-400 dark:text-gray-600 select-none mr-2 inline-block w-10 text-right">
                    {i + 1}
                  </span>
                  <HighlightedLine text={line} highlight={activeHighlight} />
                </div>
              ))}
              <div ref={contentEndRef} />
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[10px] text-gray-400">
          <span>
            {tailing && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                实时追踪中
              </span>
            )}
          </span>
          <span>{contentLines.length} 行</span>
        </div>
      </div>
    </div>
  );
}
