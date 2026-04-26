const STATUS_COLORS: Record<string, string> = {
  READY: 'bg-success-200 text-success-700',
  CONNECTING: 'bg-warning-200 text-warning-700',
  HANDSHAKING: 'bg-info-200 text-info-700',
  DISCONNECTED: 'bg-danger-200 text-danger-700',
  UNAVAILABLE: 'bg-gray-300 text-gray-700',
  VERSION_MISMATCH: 'bg-warning-200 text-warning-700',
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
