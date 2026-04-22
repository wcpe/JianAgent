import { useState, useCallback, useRef } from 'react';
import { StyledSelect } from '../../components/ui/StyledSelect.js';
import { XTerminal, type XTerminalHandle } from '../../components/terminal/XTerminal.js';
import { useWsChannel } from '../../ws/use-ws-channel.js';
import { botApi } from '../../api/bot.api.js';
import { useBotStore } from '../../stores/bot.store.js';

export function BotDebugTerm() {
  const bots = useBotStore((s) => s.bots);
  const [selectedBot, setSelectedBot] = useState<string>('');
  const [debugging, setDebugging] = useState(false);
  const termRef = useRef<XTerminalHandle>(null);

  const handleStart = useCallback(async () => {
    if (!selectedBot) return;
    await botApi.debugStart(selectedBot);
    setDebugging(true);
  }, [selectedBot]);

  const handleStop = useCallback(async () => {
    if (!selectedBot) return;
    await botApi.debugStop(selectedBot);
    setDebugging(false);
  }, [selectedBot]);

  const handleWsData = useCallback((payload: { data: string }) => {
    if (payload?.data) {
      termRef.current?.write(payload.data);
    }
  }, []);

  const debugChannel = debugging && selectedBot
    ? `terminal-session:bot-debug:output:${selectedBot}`
    : '';

  useWsChannel(debugChannel, handleWsData);

  const handleInput = useCallback(
    (data: string) => {
      if (!selectedBot || !debugging) return;
      botApi.debugCommand(selectedBot, data.trim());
    },
    [selectedBot, debugging],
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-2 bg-gray-800 text-white text-sm">
        <StyledSelect
          value={selectedBot}
          onChange={(e) => setSelectedBot(e.target.value)}
        >
          <option value="">选择 Bot...</option>
          {bots.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name}
            </option>
          ))}
        </StyledSelect>
        {!debugging ? (
          <button
            onClick={handleStart}
            disabled={!selectedBot}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-sm"
          >
            启动调试
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
          >
            停止调试
          </button>
        )}
      </div>
      <div className="flex-1">
        {debugging && selectedBot ? (
          <XTerminal ref={termRef} onData={handleInput} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            选择一个 Bot 并启动调试
          </div>
        )}
      </div>
    </div>
  );
}
