import { type FC, useMemo } from 'react';

interface DataKeyConfig {
  readonly key: string;
  readonly color: string;
  readonly name: string;
  readonly yAxisId?: string;
}

interface TimeSeriesChartProps {
  readonly data: readonly object[];
  readonly dataKeys: readonly DataKeyConfig[];
  readonly xAxisKey?: string;
  readonly height?: number;
  readonly dualYAxis?: boolean;
}

function formatTimestamp(ts: unknown): string {
  try {
    const d = new Date(ts as string | number);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  } catch {
    return String(ts);
  }
}

function toNumber(v: unknown): number {
  return typeof v === 'number' ? v : Number(v) || 0;
}

const PADDING = 40;
const RIGHT_PAD = 16;
const TOP_PAD = 10;
const BOTTOM_PAD = 24;

const TimeSeriesChart: FC<TimeSeriesChartProps> = ({
  data,
  dataKeys,
  xAxisKey = 'timestamp',
  height = 300,
}) => {
  const svgWidth = 600;

  const { paths, legendItems } = useMemo(() => {
    if (data.length === 0) return { paths: [] as string[], legendItems: [] as { color: string; name: string }[] };

    const plotW = svgWidth - PADDING - RIGHT_PAD;
    const plotH = height - TOP_PAD - BOTTOM_PAD;

    const result: string[] = [];
    const legends: { color: string; name: string }[] = [];

    for (const dk of dataKeys) {
      const vals = data.map((d) => toNumber((d as Record<string, unknown>)[dk.key]));
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const range = max - min || 1;

      const points = vals.map((v, i) => {
        const x = PADDING + (i / Math.max(data.length - 1, 1)) * plotW;
        const y = TOP_PAD + plotH - ((v - min) / range) * plotH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });

      result.push(`M${points.join('L')}`);
      legends.push({ color: dk.color, name: dk.name });
    }

    return { paths: result, legendItems: legends };
  }, [data, dataKeys, height]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400" style={{ height }}>
        暂无数据
      </div>
    );
  }

  const tickCount = Math.min(data.length, 6);
  const step = Math.max(1, Math.floor((data.length - 1) / (tickCount - 1)));

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${svgWidth} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
        {/* X-axis labels */}
        {Array.from({ length: tickCount }, (_, i) => {
          const idx = Math.min(i * step, data.length - 1);
          const x = PADDING + (idx / Math.max(data.length - 1, 1)) * (svgWidth - PADDING - RIGHT_PAD);
          return (
            <text key={idx} x={x} y={height - 4} textAnchor="middle" fontSize={10} fill="#9ca3af">
              {formatTimestamp((data[idx] as Record<string, unknown>)[xAxisKey])}
            </text>
          );
        })}

        {/* Lines */}
        {paths.map((d, i) => (
          <path key={dataKeys[i]!.key} d={d} fill="none" stroke={dataKeys[i]!.color} strokeWidth={2} />
        ))}

        {/* Legend */}
        {legendItems.map((item, i) => (
          <g key={item.name} transform={`translate(${PADDING + i * 100}, ${height - 4})`}>
            <line x1={0} y1={-3} x2={12} y2={-3} stroke={item.color} strokeWidth={2} />
            <text x={16} y={0} fontSize={10} fill="#d1d5db">{item.name}</text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export default TimeSeriesChart;
