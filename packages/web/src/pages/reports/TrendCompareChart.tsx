import { type FC, useEffect, useState } from 'react';
import { useReportStore } from '../../stores/report.store.js';
import { reportApi } from '../../api/report.api.js';

interface MetricTimeSeriesPoint {
  readonly timestamp: number;
  readonly value: number;
}

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6'];

interface Props {
  readonly sessionIds: readonly string[];
  readonly metric: string;
  readonly yLabel: string;
}

interface NormalizedPoint {
  readonly relativeMinutes: number;
  readonly value: number;
}

interface SeriesData {
  readonly sessionId: string;
  readonly label: string;
  readonly color: string;
  readonly points: readonly NormalizedPoint[];
}

export const TrendCompareChart: FC<Props> = ({ sessionIds, metric, yLabel }) => {
  const [seriesList, setSeriesList] = useState<readonly SeriesData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionIds.length === 0) {
      setSeriesList([]);
      return;
    }

    setLoading(true);
    Promise.all(
      sessionIds.map(async (sid, idx) => {
        const data = await reportApi.getSessionMetrics(sid, metric);
        const startTs = data.length > 0 ? data[0]!.timestamp : 0;
        const points: NormalizedPoint[] = data.map((p) => ({
          relativeMinutes: Number(((p.timestamp - startTs) / 60_000).toFixed(2)),
          value: p.value,
        }));
        return {
          sessionId: sid,
          label: sid.slice(0, 8),
          color: COLORS[idx % COLORS.length]!,
          points,
        };
      }),
    )
      .then(setSeriesList)
      .finally(() => setLoading(false));
  }, [sessionIds, metric]);

  if (loading) {
    return <div className="text-zinc-400 text-sm py-4">加载图表数据...</div>;
  }

  if (seriesList.length === 0) {
    return null;
  }

  // Find max values for scaling
  const allPoints = seriesList.flatMap((s) => s.points);
  const maxMinutes = Math.max(...allPoints.map((p) => p.relativeMinutes), 1);
  const maxValue = Math.max(...allPoints.map((p) => p.value), 1);

  const chartWidth = 800;
  const chartHeight = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const scaleX = (minutes: number) => padding.left + (minutes / maxMinutes) * innerWidth;
  const scaleY = (value: number) => padding.top + innerHeight - (value / maxValue) * innerHeight;

  return (
    <div className="bg-zinc-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-3">{yLabel} 趋势对比</h3>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = padding.top + innerHeight * (1 - frac);
          return (
            <g key={frac}>
              <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="#3f3f46" strokeWidth={1} />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-zinc-500 text-[10px]">
                {(maxValue * frac).toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* X axis label */}
        <text x={chartWidth / 2} y={chartHeight - 4} textAnchor="middle" className="fill-zinc-500 text-[10px]">
          经过时间 (分钟)
        </text>

        {/* Series lines */}
        {seriesList.map((series) => {
          if (series.points.length < 2) return null;
          const d = series.points
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.relativeMinutes)} ${scaleY(p.value)}`)
            .join(' ');
          return (
            <path key={series.sessionId} d={d} fill="none" stroke={series.color} strokeWidth={2} />
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 mt-2">
        {seriesList.map((s) => (
          <div key={s.sessionId} className="flex items-center gap-1.5 text-xs text-zinc-300">
            <div className="w-3 h-0.5" style={{ backgroundColor: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
};
