const STATE_COLORS: Record<string, string> = {
  NOT_CONFIGURED: 'bg-gray-400',
  STOPPED: 'bg-danger-500',
  STARTING: 'bg-warning-400 animate-pulse',
  RUNNING: 'bg-success-500',
  STOPPING: 'bg-warning-400',
  CRASHED: 'bg-danger-700',
  ATTACHED_EXTERNAL: 'bg-info-500',
  UNKNOWN: 'bg-gray-500',
};

export function ServerStatusBadge({ state }: { readonly state: string }) {
  return (
    <span
      className={`inline-block px-2 py-1 rounded text-white text-xs font-medium ${
        STATE_COLORS[state] ?? 'bg-gray-500'
      }`}
    >
      {state}
    </span>
  );
}
