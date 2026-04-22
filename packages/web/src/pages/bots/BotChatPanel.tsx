import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { MessageCircle, ChevronDown, ChevronUp, Trash2, Search, X, Download, Filter } from 'lucide-react';
import { useWsChannel } from '../../ws/use-ws-channel.js';

interface ChatMessage {
  readonly botName: string;
  readonly message: string;
  readonly timestamp: number;
}

const MAX_MESSAGES = 500;

/** Classify message type for coloring */
function getMsgType(msg: string): 'system' | 'command' | 'whisper' | 'death' | 'join' | 'normal' {
  if (msg.startsWith('/') || msg.startsWith('.')) return 'command';
  if (msg.includes('whispers') || msg.includes('悄悄话') || msg.includes('-> me')) return 'whisper';
  if (msg.includes('死亡') || msg.includes('was slain') || msg.includes('died') || msg.includes('killed')) return 'death';
  if (msg.includes('joined') || msg.includes('left') || msg.includes('加入') || msg.includes('离开')) return 'join';
  if (msg.startsWith('[Server]') || msg.startsWith('[系统]') || msg.startsWith('§')) return 'system';
  return 'normal';
}

const MSG_COLORS: Record<ReturnType<typeof getMsgType>, string> = {
  system: 'text-yellow-400',
  command: 'text-green-400',
  whisper: 'text-purple-400',
  death: 'text-red-400',
  join: 'text-gray-500',
  normal: 'text-gray-800 dark:text-gray-200',
};

export function BotChatPanel() {
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Filter & search
  const [searchText, setSearchText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [filterBot, setFilterBot] = useState('');

  const handleChat = useCallback((payload: ChatMessage) => {
    setMessages((prev) => {
      const next = [...prev, payload];
      return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
    });
  }, []);

  useWsChannel('bot:chat', handleChat);

  // Unique bot names for filter dropdown
  const botNames = useMemo(() => {
    const names = new Set(messages.map((m) => m.botName));
    return [...names].sort();
  }, [messages]);

  // Filtered messages
  const filteredMessages = useMemo(() => {
    let filtered = messages;
    if (filterBot) {
      filtered = filtered.filter((m) => m.botName === filterBot);
    }
    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      filtered = filtered.filter((m) => m.message.toLowerCase().includes(lower) || m.botName.toLowerCase().includes(lower));
    }
    return filtered;
  }, [messages, filterBot, searchText]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredMessages]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 40;
  }, []);

  const handleClear = useCallback(() => {
    setMessages([]);
  }, []);

  const handleExport = useCallback(() => {
    const text = filteredMessages
      .map((m) => `[${new Date(m.timestamp).toLocaleTimeString()}] [${m.botName}] ${m.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-log-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredMessages]);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-750 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          <MessageCircle className="w-4 h-4" />
          <span>游戏聊天</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            ({filteredMessages.length}{filterBot || searchText ? `/${messages.length}` : ''})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!collapsed && (
            <>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setShowSearch((v) => !v); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setShowSearch((v) => !v); } }}
                className={`transition-colors ${showSearch ? 'text-blue-400' : 'text-gray-400 hover:text-gray-300'}`}
                title="搜索消息"
              >
                <Search className="w-3.5 h-3.5" />
              </span>
              {messages.length > 0 && (
                <>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); handleExport(); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleExport(); } }}
                    className="text-gray-400 hover:text-blue-400 transition-colors"
                    title="导出聊天记录"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); handleClear(); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleClear(); } }}
                    className="text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </span>
                </>
              )}
            </>
          )}
          {collapsed ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Bot filter bar — always visible when expanded and multiple bots exist */}
      {!collapsed && botNames.length > 1 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <Filter className="w-3 h-3 text-gray-400 shrink-0" />
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setFilterBot('')}
              className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                !filterBot
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              公共频道
            </button>
            {botNames.map((n) => (
              <button
                key={n}
                onClick={() => setFilterBot(filterBot === n ? '' : n)}
                className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                  filterBot === n
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search bar */}
      {!collapsed && showSearch && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
          <Search className="w-3 h-3 text-gray-400" />
          <input
            type="text"
            placeholder="搜索消息..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="flex-1 bg-transparent text-xs text-gray-700 dark:text-gray-300 outline-none placeholder-gray-400"
            autoFocus
          />
          {searchText && (
            <button onClick={() => setSearchText('')} className="text-gray-400 hover:text-gray-200">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      {!collapsed && (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-48 overflow-y-auto px-3 py-2 space-y-0.5 font-mono text-xs"
        >
          {filteredMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
              {messages.length === 0 ? '等待游戏消息...' : '无匹配消息'}
            </div>
          ) : (
            filteredMessages.map((msg, i) => {
              const msgType = getMsgType(msg.message);
              return (
                <div key={`${msg.timestamp}-${i}`} className="flex gap-2 leading-5">
                  <span className="text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-blue-500 dark:text-blue-400 shrink-0 font-semibold">
                    [{msg.botName}]
                  </span>
                  <span className={`break-all ${MSG_COLORS[msgType]}`}>
                    {msg.message}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
