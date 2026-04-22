import { type FC, useEffect, useState } from 'react';
import { getPhaseSummaries } from '../../api/phase.api.js';
import type { PhaseSummaryDto } from '@jian-agent/shared-domain';

interface Props {
  readonly sessionId: string;
}

const statusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'text-green-600 dark:text-green-400';
    case 'failed':
      return 'text-red-600 dark:text-red-400';
    case 'skipped':
      return 'text-zinc-500 dark:text-zinc-400';
    default:
      return '';
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case 'completed':
      return '✔ 完成';
    case 'failed':
      return '✘ 失败';
    case 'skipped':
      return '— 跳过';
    default:
      return status;
  }
};

const formatDuration = (ms: number) => {
  if (ms < 1_000) return `${ms}ms`;
  const s = (ms / 1_000).toFixed(1);
  return `${s}s`;
};

const PhaseSummaryPanel: FC<Props> = ({ sessionId }) => {
  const [summaries, setSummaries] = useState<readonly PhaseSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPhaseSummaries(sessionId)
      .then((res) => {
        if (!cancelled) setSummaries(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (loading) return <div className="text-sm text-zinc-500">加载阶段汇总...</div>;
  if (error) return <div className="text-sm text-red-500">{error}</div>;
  if (summaries.length === 0)
    return <div className="text-sm text-zinc-500">暂无阶段汇总数据</div>;

  return (
    <div className="overflow-x-auto">
      <h3 className="text-sm font-semibold mb-2">阶段汇总</h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-zinc-100 dark:bg-zinc-800 text-left">
            <th className="px-2 py-1">#</th>
            <th className="px-2 py-1">阶段</th>
            <th className="px-2 py-1">时长</th>
            <th className="px-2 py-1">Bot 入/出</th>
            <th className="px-2 py-1">断连</th>
            <th className="px-2 py-1">错误</th>
            <th className="px-2 py-1">Avg TPS</th>
            <th className="px-2 py-1">Min TPS</th>
            <th className="px-2 py-1">Avg MSPT</th>
            <th className="px-2 py-1">Max MSPT</th>
            <th className="px-2 py-1">状态</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((s) => (
            <tr
              key={s.id}
              className="border-t border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <td className="px-2 py-1">{s.phaseIndex}</td>
              <td className="px-2 py-1 font-medium">{s.phaseName}</td>
              <td className="px-2 py-1">{formatDuration(s.durationMs)}</td>
              <td className="px-2 py-1">
                {s.botsAtEntry} → {s.botsAtExit}
              </td>
              <td className="px-2 py-1">{s.disconnectCount}</td>
              <td className="px-2 py-1">{s.errorCount}</td>
              <td className="px-2 py-1">{s.avgTps?.toFixed(1) ?? '—'}</td>
              <td className="px-2 py-1">{s.minTps?.toFixed(1) ?? '—'}</td>
              <td className="px-2 py-1">{s.avgMspt?.toFixed(1) ?? '—'}</td>
              <td className="px-2 py-1">{s.maxMspt?.toFixed(1) ?? '—'}</td>
              <td className={`px-2 py-1 font-medium ${statusColor(s.completionStatus)}`}>
                {statusLabel(s.completionStatus)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PhaseSummaryPanel;
