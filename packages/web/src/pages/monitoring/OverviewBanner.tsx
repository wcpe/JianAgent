import type { MonitoringOverviewDto } from '@jian-agent/shared-domain';
import { AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';

interface OverviewBannerProps {
  readonly overview: MonitoringOverviewDto;
}

export function OverviewBanner({ overview }: OverviewBannerProps) {
  return (
    <div className="mb-6 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-800 text-white shadow-2xl p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-white/70 mb-1">
            {overview.state === 'healthy' ? <ShieldCheck size={16} className="text-emerald-300" /> : overview.state === 'degraded' ? <AlertTriangle size={16} className="text-amber-300" /> : <ShieldAlert size={16} className="text-rose-300" />}
            监控联动摘要
          </div>
          <h2 className="text-xl font-semibold">{overview.state === 'healthy' ? '当前运行平稳' : overview.state === 'degraded' ? '出现性能退化信号' : '检测到高优先级风险'}</h2>
          <p className="text-sm text-white/65 mt-1">{overview.signals.length > 0 ? overview.signals[0].message : '最近一次采样未发现明显异常。'}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm min-w-[220px]">
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <div className="text-white/50 text-xs">活跃规则</div>
            <div className="text-lg font-semibold">{overview.activeRuleCount}</div>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <div className="text-white/50 text-xs">JMX 任务</div>
            <div className="text-lg font-semibold">{overview.activeJmxScheduleCount}</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {overview.signals.slice(0, 3).map((signal) => (
          <div key={signal.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs uppercase tracking-wide text-white/55">{signal.source}</span>
              <span className={`text-xs font-medium ${signal.level === 'CRITICAL' ? 'text-rose-300' : signal.level === 'WARNING' ? 'text-amber-300' : 'text-sky-300'}`}>{signal.level}</span>
            </div>
            <div className="font-medium text-sm">{signal.metric}</div>
            <div className="text-xs text-white/70 mt-1">{signal.message}</div>
          </div>
        ))}
        {overview.signals.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70 md:col-span-3">没有触发联动信号，当前状态由服务器与 JVM 观测共同判定为健康。</div>
        )}
      </div>
    </div>
  );
}
