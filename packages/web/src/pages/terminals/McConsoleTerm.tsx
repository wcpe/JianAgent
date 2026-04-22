import { useRef, useCallback, useEffect, useState } from 'react';
import { XTerminal, type XTerminalHandle } from '../../components/terminal/XTerminal.js';
import { useTerminalSession } from '../../features/terminal-session/use-terminal-session.js';
import { apiFetch } from '../../api/client.js';

/**
 * MC Console with local echo & line-buffered input.
 * Piped stdin doesn't echo, so we handle it client-side.
 * Fetches historical output buffer on mount.
 */
export function McConsoleTerm({ serverId }: { readonly serverId?: string }) {
  const lineBufferRef = useRef('');
  const termRef = useRef<XTerminalHandle>(null);
  const [initialLines, setInitialLines] = useState<readonly string[]>([]);

  useEffect(() => {
    if (!serverId) return;
    apiFetch<{ lines: string[] }>(`/servers/${serverId}/output`)
      .then((res) => setInitialLines(res.lines))
      .catch(() => { /* ignore — no history available */ });
  }, [serverId]);

  const { sendInput } = useTerminalSession({
    config: { sessionType: 'MC_CONSOLE', targetId: serverId ?? '' },
    onData: (data) => {
      termRef.current?.write(data);
    }
  });

  const handleData = useCallback(
    (data: string) => {
      for (const ch of data) {
        if (ch === '\r') {
          // Send the accumulated line + newline to the server
          const line = lineBufferRef.current;
          lineBufferRef.current = '';
          sendInput(line + '\n');
        } else if (ch === '\x7f' || ch === '\b') {
          // Backspace: remove last character from buffer
          if (lineBufferRef.current.length > 0) {
            lineBufferRef.current = lineBufferRef.current.slice(0, -1);
          }
        } else if (ch >= ' ') {
          // Printable character: add to buffer
          lineBufferRef.current += ch;
        }
      }
    },
    [sendInput],
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white text-sm">
        <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
        <span>Minecraft 服务端控制台{serverId ? ` (${serverId})` : ''}</span>
      </div>
      <div className="flex-1">
        <XTerminal ref={termRef} onData={handleData} localEcho initialLines={initialLines} />
      </div>
    </div>
  );
}
