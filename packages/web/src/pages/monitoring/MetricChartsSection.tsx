import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, ReferenceLine,
} from 'recharts';
import type { MetricSnapshotDto, AlertRuleDto } from '@jian-agent/shared-domain';
import { Activity, Users, HardDrive, Cpu, Globe } from 'lucide-react';
import { ChartCard, formatTime, TOOLTIP_STYLE } from './ChartCard.js';

interface MetricChartsSectionProps {
  readonly history: readonly MetricSnapshotDto[];
  readonly lastPoint: MetricSnapshotDto | null;
  readonly maxMem: number | null | undefined;
  readonly worldSummaryCount: number;
  readonly alertRules?: readonly AlertRuleDto[];
  readonly onChartClick?: (timestamp: string) => void;
}

function getAlertRulesForMetric(rules: readonly AlertRuleDto[] | undefined, metric: string): readonly AlertRuleDto[] {
  if (!rules || !Array.isArray(rules)) return [];
  return rules.filter((r) => r.enabled && r.metric === metric);
}

export function MetricChartsSection({ history, lastPoint, maxMem, worldSummaryCount, alertRules, onChartClick }: MetricChartsSectionProps) {
  const handleChartClick = (data: any) => {
    if (!onChartClick || !data?.activePayload?.[0]?.payload?.timestamp) return;
    onChartClick(data.activePayload[0].payload.timestamp as string);
  };
  const tpsRules = getAlertRulesForMetric(alertRules, 'TPS');
  const msptRules = getAlertRulesForMetric(alertRules, 'MSPT');
  const memRules = getAlertRulesForMetric(alertRules, 'MEMORY_USAGE');
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* TPS Chart */}
      <ChartCard
        title="TPS"
        icon={<Activity size={16} className="text-green-500" />}
        lastValue={lastPoint?.tps?.toFixed(1)}
        accentColor={(lastPoint?.tps ?? 20) >= 18 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
      >
        <ResponsiveContainer width="100%" height={192}>
          <LineChart data={history as MetricSnapshotDto[]} onClick={handleChartClick}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <YAxis domain={[0, 22]} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <Tooltip labelFormatter={(v) => new Date(v as string).toLocaleString()} contentStyle={TOOLTIP_STYLE} />
            <ReferenceLine y={20} stroke="#22C55E" strokeDasharray="5 5" strokeOpacity={0.5} />
            {tpsRules.map((rule) => (
              <ReferenceLine key={rule.id} y={rule.threshold} stroke="#EF4444" strokeDasharray="4 4" label={{ value: `告警 ${rule.threshold}`, fill: '#EF4444', fontSize: 10 }} />
            ))}
            <Line type="monotone" dataKey="tps" stroke="#22C55E" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* MSPT Chart */}
      <ChartCard
        title="MSPT"
        icon={<Cpu size={16} className="text-yellow-500" />}
        lastValue={lastPoint?.mspt?.toFixed(1)}
        accentColor={(lastPoint?.mspt ?? 0) <= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}
      >
        <ResponsiveContainer width="100%" height={192}>
          <AreaChart data={history as MetricSnapshotDto[]} onClick={handleChartClick}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <Tooltip labelFormatter={(v) => new Date(v as string).toLocaleString()} contentStyle={TOOLTIP_STYLE} />
            <ReferenceLine y={50} stroke="#EF4444" strokeDasharray="5 5" strokeOpacity={0.5} />
            {msptRules.map((rule) => (
              <ReferenceLine key={rule.id} y={rule.threshold} stroke="#EF4444" strokeDasharray="4 4" label={{ value: `告警 ${rule.threshold}`, fill: '#EF4444', fontSize: 10 }} />
            ))}
            <Area type="monotone" dataKey="mspt" stroke="#EAB308" fill="#EAB30820" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* CPU Usage Chart */}
      <ChartCard
        title="CPU (%)"
        icon={<Cpu size={16} className="text-rose-500" />}
        lastValue={lastPoint?.cpuUsage != null ? `${lastPoint.cpuUsage.toFixed(1)}%` : undefined}
        accentColor={(lastPoint?.cpuUsage ?? 0) < 80 ? 'text-rose-600 dark:text-rose-400' : 'text-red-600 dark:text-red-400'}
      >
        <ResponsiveContainer width="100%" height={192}>
          <AreaChart data={history as MetricSnapshotDto[]} onClick={handleChartClick}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <Tooltip labelFormatter={(v) => new Date(v as string).toLocaleString()} contentStyle={TOOLTIP_STYLE} />
            <ReferenceLine y={80} stroke="#EF4444" strokeDasharray="5 5" strokeOpacity={0.5} />
            <Area type="monotone" dataKey="cpuUsage" stroke="#F43F5E" fill="#F43F5E20" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Players Chart */}
      <ChartCard
        title="在线玩家"
        icon={<Users size={16} className="text-blue-500" />}
        lastValue={`${lastPoint?.onlinePlayers ?? 0}/${lastPoint?.maxPlayers ?? '?'}`}
        accentColor="text-blue-600 dark:text-blue-400"
      >
        <ResponsiveContainer width="100%" height={192}>
          <AreaChart data={history as MetricSnapshotDto[]} onClick={handleChartClick}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" allowDecimals={false} />
            <Tooltip labelFormatter={(v) => new Date(v as string).toLocaleString()} contentStyle={TOOLTIP_STYLE} />
            <Area type="stepAfter" dataKey="onlinePlayers" stroke="#3B82F6" fill="#3B82F620" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Memory Chart */}
      <ChartCard
        title="内存使用 (MB)"
        icon={<HardDrive size={16} className="text-purple-500" />}
        lastValue={lastPoint?.memoryUsageMb != null ? `${lastPoint.memoryUsageMb.toFixed(0)} MB` : undefined}
        accentColor="text-purple-600 dark:text-purple-400"
      >
        <ResponsiveContainer width="100%" height={192}>
          <AreaChart data={history as MetricSnapshotDto[]} onClick={handleChartClick}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <Tooltip labelFormatter={(v) => new Date(v as string).toLocaleString()} contentStyle={TOOLTIP_STYLE} />
            {maxMem && <ReferenceLine y={maxMem} stroke="#EF4444" strokeDasharray="5 5" strokeOpacity={0.5} label={{ value: `Max ${maxMem.toFixed(0)}`, fill: '#EF4444', fontSize: 10 }} />}
            {memRules.map((rule) => (
              <ReferenceLine key={rule.id} y={rule.threshold} stroke="#EF4444" strokeDasharray="4 4" label={{ value: `告警 ${rule.threshold}%`, fill: '#EF4444', fontSize: 10 }} />
            ))}
            <Area type="monotone" dataKey="memoryUsageMb" stroke="#A855F7" fill="#A855F720" strokeWidth={2} />
            <Area type="monotone" dataKey="maxMemoryMb" stroke="#A855F740" fill="none" strokeDasharray="4 4" strokeWidth={1} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Entity Count Chart */}
      <ChartCard
        title="实体数量"
        icon={<Activity size={16} className="text-cyan-500" />}
        lastValue={String(lastPoint?.entityCount ?? 0)}
        accentColor="text-cyan-600 dark:text-cyan-400"
      >
        <ResponsiveContainer width="100%" height={192}>
          <LineChart data={history as MetricSnapshotDto[]} onClick={handleChartClick}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" allowDecimals={false} />
            <Tooltip labelFormatter={(v) => new Date(v as string).toLocaleString()} contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="entityCount" stroke="#06B6D4" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Loaded Chunks Chart */}
      <ChartCard
        title="已加载区块"
        icon={<HardDrive size={16} className="text-orange-500" />}
        lastValue={String(lastPoint?.loadedChunks ?? 0)}
        accentColor="text-orange-600 dark:text-orange-400"
      >
        <ResponsiveContainer width="100%" height={192}>
          <LineChart data={history as MetricSnapshotDto[]} onClick={handleChartClick}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" allowDecimals={false} />
            <Tooltip labelFormatter={(v) => new Date(v as string).toLocaleString()} contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="loadedChunks" stroke="#F97316" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* World Count Chart */}
      <ChartCard
        title="世界数量"
        icon={<Globe size={16} className="text-teal-500" />}
        lastValue={String(lastPoint?.worldCount ?? (worldSummaryCount || '—'))}
        accentColor="text-teal-600 dark:text-teal-400"
      >
        <ResponsiveContainer width="100%" height={192}>
          <LineChart data={history as MetricSnapshotDto[]} onClick={handleChartClick}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" allowDecimals={false} />
            <Tooltip labelFormatter={(v) => new Date(v as string).toLocaleString()} contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="worldCount" stroke="#14B8A6" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
