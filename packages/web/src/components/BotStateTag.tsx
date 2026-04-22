const STATE_COLORS: Record<string, string> = {
  CREATED: 'bg-gray-200 text-gray-700',
  CONNECTING: 'bg-yellow-200 text-yellow-800',
  SPAWNED: 'bg-green-200 text-green-800',
  RUNNING_BEHAVIOR: 'bg-blue-200 text-blue-800',
  DISCONNECTED: 'bg-red-200 text-red-800',
  STOPPED: 'bg-gray-400 text-gray-900',
  ERROR: 'bg-red-400 text-white',
};

interface Props {
  readonly state: string;
}

export function BotStateTag({ state }: Props) {
  const colors = STATE_COLORS[state] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors}`}>
      {state}
    </span>
  );
}
