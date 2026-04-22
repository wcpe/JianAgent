import type { ResourceDetailDto } from '@jian-agent/shared-domain';

interface MonitoringStatusTabProps {
  readonly detail: ResourceDetailDto;
}

function Row({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-slate-900 dark:text-slate-100">{value}</span>
    </div>
  );
}

export function MonitoringStatusTab({ detail }: MonitoringStatusTabProps) {
  const monitoring = detail.capabilities.monitoring;

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-3xl border border-white/60 bg-white/85 p-5 shadow-xl backdrop-blur-xl dark:border-primary-300/20 dark:bg-slate-950/70">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
          Monitoring
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
          {detail.kind === 'REMOTE_HOST' ? '连接观测' : '监控与健康'}
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {detail.kind === 'REMOTE_HOST'
            ? '首版仅展示远程主机连通性与 SSH 会话相关的观测摘要。'
            : '展示统一资源读模型下的健康、探针和监控能力摘要。'}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Row label="运行状态" value={detail.status.state} />
        <Row label="健康状态" value={detail.status.health} />
        <Row
          label={detail.kind === 'REMOTE_HOST' ? 'SSH 可用' : '探针活跃'}
          value={
            detail.kind === 'REMOTE_HOST'
              ? detail.capabilities.terminal.enabled
                ? '是'
                : '否'
              : monitoring.probeActive
                ? '是'
                : '否'
          }
        />
        <Row
          label={detail.kind === 'REMOTE_HOST' ? '文件能力' : '告警规则'}
          value={
            detail.kind === 'REMOTE_HOST'
              ? detail.capabilities.files.enabled
                ? '已启用'
                : '未启用'
              : String(monitoring.alertRuleCount)
          }
        />
        {detail.kind === 'SERVER' ? (
          <>
            <Row label="JMX 配置" value={monitoring.jmxEnabled ? '已启用' : '未启用'} />
            <Row label="监控能力" value={monitoring.enabled ? '可用' : '不可用'} />
          </>
        ) : null}
      </div>
    </div>
  );
}
