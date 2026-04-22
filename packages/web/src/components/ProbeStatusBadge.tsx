const STATUS_COLORS: Record<string, string> = {
  READY: 'bg-green-200 text-green-800',
  CONNECTING: 'bg-yellow-200 text-yellow-800',
  HANDSHAKING: 'bg-blue-200 text-blue-800',
  DISCONNECTED: 'bg-red-200 text-red-800',
  UNAVAILABLE: 'bg-gray-300 text-gray-700',
  VERSION_MISMATCH: 'bg-orange-200 text-orange-800',
};

interface Props {
  readonly connected: boolean;
  readonly status?: string;
}

export function ProbeStatusBadge({ connected, status }: Props) {
  const label = status ?? (connected ? 'READY' : 'DISCONNECTED');
  const colors = STATUS_COLORS[label] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors}`}>
      {label}
    </span>
  );
}
