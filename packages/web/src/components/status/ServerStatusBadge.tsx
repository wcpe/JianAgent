const STATE_COLORS: Record<string, string> = {
  NOT_CONFIGURED: 'bg-gray-400',
  STOPPED: 'bg-red-500',
  STARTING: 'bg-yellow-400 animate-pulse',
  RUNNING: 'bg-green-500',
  STOPPING: 'bg-yellow-400',
  CRASHED: 'bg-red-700',
  ATTACHED_EXTERNAL: 'bg-blue-500',
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
