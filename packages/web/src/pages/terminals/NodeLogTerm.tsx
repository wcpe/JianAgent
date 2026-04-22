import { useEffect, useState, useRef, useCallback } from 'react';
import { XTerminal, type XTerminalHandle } from '../../components/terminal/XTerminal.js';
import { useWsChannel } from '../../ws/use-ws-channel.js';
import { apiFetch } from '../../api/client.js';
import { WsChannel } from '@jian-agent/shared-protocol';

export function NodeLogTerm() {
  const termRef = useRef<XTerminalHandle>(null);
  const [initialLines, setInitialLines] = useState<readonly string[]>([]);

  useEffect(() => {
    apiFetch<{ lines: string[] }>('/node-log/history')
      .then((res) => setInitialLines(res.lines ?? []))
      .catch(() => { /* no history available */ });
  }, []);

  const handleWsData = useCallback((payload: { data: string }) => {
    if (payload?.data) {
      termRef.current?.write(payload.data);
    }
  }, []);

  useWsChannel(WsChannel.TERMINAL_SESSION_NODE_LOG, handleWsData);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white text-sm">
        <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
        <span>Node 主控日志</span>
      </div>
      <div className="flex-1">
        <XTerminal ref={termRef} readonly initialLines={initialLines} />
      </div>
    </div>
  );
}
