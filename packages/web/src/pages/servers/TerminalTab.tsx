import { TerminalSessionPanel } from '../../features/terminal-session/TerminalSessionPanel.js';

interface TerminalTabProps {
  readonly serverId: string;
}

/**
 * TerminalTab — Thin wrapper around TerminalSessionPanel for MC console sessions.
 * All terminal lifecycle, WS communication, and UI is delegated to the unified session layer.
 */
export function TerminalTab({ serverId }: TerminalTabProps) {
  return (
    <TerminalSessionPanel
      sessionType="MC_CONSOLE"
      targetId={serverId}
      className="z-0 relative"
    />
  );
}
