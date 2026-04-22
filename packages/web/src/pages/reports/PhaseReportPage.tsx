import { type FC, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { reportApi } from '../../api/report.api.js';
import type { SessionReportDto } from '@jian-agent/shared-domain';

const PhaseReportPage: FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [report, setReport] = useState<SessionReportDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    reportApi
      .getSessionReport(sessionId)
      .then(setReport)
      .catch((err: any) => setError(err.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <p className="p-6 text-zinc-400">加载中...</p>;
  if (error) return <p className="p-6 text-red-400">{error}</p>;
  if (!report) return <p className="p-6 text-zinc-400">未找到报告数据</p>;

  const totalDuration = report.durationMs || 1;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-zinc-100">
        阶段报告: {report.sessionId.slice(0, 8)}
      </h1>

      {/* Overview cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card label="持续时间" value={`${(report.durationMs / 60_000).toFixed(1)}分`} />
        <Card label="Bot 峰值" value={String(report.botStats.peakOnline)} />
        <Card label="平均 TPS" value={report.serverPerf.avgTps.toFixed(1)} />
        <Card label="告警数" value={String(report.alerts.total)} />
      </div>

      {/* Phase Gantt-style timeline */}
      <div className="bg-zinc-800 rounded-lg p-4">
        <h2 className="text-sm font-medium text-zinc-300 mb-4">阶段甘特图</h2>
        <div className="space-y-3">
          {report.phases.map((phase) => {
            const startPct = ((phase.startTime - report.startTime) / totalDuration) * 100;
            const widthPct = Math.max(((phase.endTime - phase.startTime) / totalDuration) * 100, 2);
            const bgColor =
              phase.status === 'completed' ? 'bg-green-500/80' :
              phase.status === 'failed' ? 'bg-red-500/80' : 'bg-zinc-600';

            return (
              <div key={phase.phaseId} className="flex items-center gap-3">
                <span className="w-36 text-xs text-zinc-400 truncate text-right">
                  {phase.phaseName}
                </span>
                <div className="flex-1 relative h-7 bg-zinc-700 rounded overflow-hidden">
                  <div
                    className={`absolute top-0 h-full rounded ${bgColor} flex items-center px-2`}
                    style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                  >
                    <span className="text-[10px] text-white truncate">
                      {phase.botCount} bots · {phase.avgTps.toFixed(0)} TPS
                    </span>
                  </div>
                </div>
                <span
                  className={`w-20 text-xs font-medium ${
                    phase.status === 'completed' ? 'text-green-400' :
                    phase.status === 'failed' ? 'text-red-400' : 'text-zinc-500'
                  }`}
                >
                  {phase.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Conclusions */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-300">自动总结</h2>
        {report.conclusions.map((c, i) => (
          <div
            key={i}
            className="bg-blue-900/20 border-l-4 border-blue-500 px-4 py-3 rounded text-sm text-zinc-200"
          >
            {c}
          </div>
        ))}
      </div>
    </div>
  );
};

const Card: FC<{ readonly label: string; readonly value: string }> = ({ label, value }) => (
  <div className="bg-zinc-800 rounded-lg p-4 text-center">
    <div className="text-2xl font-bold text-zinc-100">{value}</div>
    <div className="text-xs text-zinc-400 mt-1">{label}</div>
  </div>
);

export default PhaseReportPage;
