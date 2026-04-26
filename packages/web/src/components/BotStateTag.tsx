const STATE_COLORS: Record<string, string> = {
  CREATED: 'bg-gray-200 text-gray-700',
  CONNECTING: 'bg-warning-200 text-warning-700',
  SPAWNED: 'bg-success-200 text-success-700',
  RUNNING_BEHAVIOR: 'bg-info-200 text-info-700',
  DISCONNECTED: 'bg-danger-200 text-danger-700',
  STOPPED: 'bg-gray-400 text-gray-900',
  ERROR: 'bg-danger-400 text-white',
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
