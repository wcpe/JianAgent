import { TerminalSessionPanel } from '../../features/terminal-session/TerminalSessionPanel.js';

interface SshTerminalTabProps {
  readonly serverId: string;
}

/**
 * SshTerminalTab — Thin wrapper around TerminalSessionPanel for SSH shell sessions.
 * All SSH connection management, terminal lifecycle, and WS communication is delegated to the unified session layer.
 */
export function SshTerminalTab({ serverId }: SshTerminalTabProps) {
  return (
    <TerminalSessionPanel
      sessionType="SSH_SHELL"
      targetId={serverId}
      className="z-0 relative"
    />
  );
}
