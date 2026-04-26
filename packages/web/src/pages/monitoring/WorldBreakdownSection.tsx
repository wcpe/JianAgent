import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import type { WorldMetricSnapshotDto } from '@jian-agent/shared-domain';
import { Activity, Globe, Plug } from 'lucide-react';
import { ChartCard, TOOLTIP_STYLE, PIE_COLORS } from './ChartCard.js';

function aggregateEntityTypes(worlds: readonly WorldMetricSnapshotDto[]): { name: string; count: number }[] {
  const totals = new Map<string, number>();
  for (const w of worlds) {
    if (!w.entityTypes) continue;
    for (const [type, count] of Object.entries(w.entityTypes)) {
      totals.set(type, (totals.get(type) ?? 0) + count);
    }
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }));
}

export function aggregateWorldSummary(worlds: readonly WorldMetricSnapshotDto[]): { worldName: string; entities: number; chunks: number }[] {
  const latest = new Map<string, WorldMetricSnapshotDto>();
  for (const w of worlds) {
    const existing = latest.get(w.worldName);
    if (!existing || w.timestamp > existing.timestamp) {
      latest.set(w.worldName, w);
    }
  }
  return [...latest.values()].map((w) => ({
    worldName: w.worldName,
    entities: w.entityCount ?? 0,
    chunks: w.loadedChunks ?? 0,
  }));
}

interface WorldBreakdownSectionProps {
  readonly worldMetrics: readonly WorldMetricSnapshotDto[];
}

export function WorldBreakdownSection({ worldMetrics }: WorldBreakdownSectionProps) {
  const worldSummary = aggregateWorldSummary(worldMetrics);
  const entityTypeData = aggregateEntityTypes(worldMetrics);

  if (worldSummary.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
        <Globe size={18} className="text-teal-500" />
        世界详情
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Per-World Entity & Chunk Bar Chart */}
        <ChartCard
          title="各世界实体 / 区块数量"
          icon={<Activity size={16} className="text-primary-500" />}
          tall
        >
          <ResponsiveContainer width="100%" height={256}>
            <BarChart data={worldSummary} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
              <YAxis dataKey="worldName" type="category" tick={{ fontSize: 11 }} stroke="#9CA3AF" width={100} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
              <Bar dataKey="entities" name="实体" fill="#06B6D4" radius={[0, 4, 4, 0]} />
              <Bar dataKey="chunks" name="区块" fill="#F97316" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Entity Type Distribution Pie Chart */}
        {entityTypeData.length > 0 && (
          <ChartCard
            title="生物种类分布 (Top 15)"
            icon={<Plug size={16} className="text-pink-500" />}
            tall
          >
            <ResponsiveContainer width="100%" height={256}>
              <PieChart>
                <Pie
                  data={entityTypeData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={{ stroke: '#9CA3AF' }}
                  fontSize={10}
                >
                  {entityTypeData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>
    </div>
  );
}
