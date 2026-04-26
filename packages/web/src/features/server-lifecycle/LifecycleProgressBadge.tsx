interface LifecycleProgressBadgeProps {
  readonly phase: string;
  readonly message?: string;
}

const phaseColors: Record<string, string> = {
  IDLE: 'bg-gray-400',
  VALIDATING: 'bg-info-400 animate-pulse',
  PRE_START: 'bg-info-500 animate-pulse',
  STARTING: 'bg-warning-500 animate-pulse',
  POST_START: 'bg-warning-400 animate-pulse',
  RUNNING: 'bg-success-500',
  PRE_STOPPING: 'bg-warning-400 animate-pulse',
  STOPPING: 'bg-warning-500 animate-pulse',
  POST_STOPPING: 'bg-warning-200 animate-pulse',
  STOPPED: 'bg-gray-500',
  FAILED: 'bg-danger-500',
};

const phaseLabels: Record<string, string> = {
  IDLE: '空闲',
  VALIDATING: '验证中',
  PRE_START: '准备启动',
  STARTING: '启动中',
  POST_START: '启动后处理',
  RUNNING: '运行中',
  PRE_STOPPING: '准备停止',
  STOPPING: '停止中',
  POST_STOPPING: '停止后处理',
  STOPPED: '已停止',
  FAILED: '异常',
};

export function LifecycleProgressBadge({ phase, message }: LifecycleProgressBadgeProps) {
  const color = phaseColors[phase] ?? 'bg-gray-400';
  const label = phaseLabels[phase] ?? phase;

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-gray-600 dark:text-gray-400">
        {label}
        {message && ` — ${message}`}
      </span>
    </div>
  );
}
