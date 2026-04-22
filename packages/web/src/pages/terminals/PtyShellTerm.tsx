import { TerminalSessionPanel } from '../../features/terminal-session/TerminalSessionPanel.js';

export function PtyShellTerm({ serverId }: { readonly serverId?: string }) {
  if (!serverId) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--terminal-bg)] text-sm text-slate-400">
        请选择服务器后再打开 PTY Shell
      </div>
    );
  }

  return (
    <TerminalSessionPanel
      sessionType="PTY_SHELL"
      targetId={serverId}
      params={{ shell: '/bin/zsh' }}
      showToolbar={false}
      className="h-full rounded-none border-0 bg-transparent shadow-none backdrop-blur-0"
    />
  );
}
