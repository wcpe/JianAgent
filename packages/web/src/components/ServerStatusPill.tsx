interface ServerStatusPillProps {
  readonly status: 'running' | 'starting' | 'stopping' | 'stopped' | 'error' | 'unknown';
}

const STATUS_STYLES: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  running:  { dot: 'bg-green-500 animate-pulse', bg: 'bg-green-100', text: 'text-green-700', label: '运行中' },
  starting: { dot: 'bg-yellow-500 animate-pulse', bg: 'bg-yellow-100', text: 'text-yellow-700', label: '启动中' },
  stopping: { dot: 'bg-yellow-500 animate-pulse', bg: 'bg-yellow-100', text: 'text-yellow-700', label: '正在停止' },
  stopped:  { dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600', label: '已停止' },
  error:    { dot: 'bg-red-500', bg: 'bg-red-100', text: 'text-red-700', label: '异常' },
  unknown:  { dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600', label: '未知' },
};

export function ServerStatusPill({ status }: ServerStatusPillProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}
