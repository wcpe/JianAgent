import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, Line, LineChart,
  ComposedChart, BarChart, Bar, Cell, ReferenceLine,
} from 'recharts';
import type { SystemMetricsDto, DiskInfoDto } from '@jian-agent/shared-domain';
import { Cpu, MemoryStick, HardDrive, Network } from 'lucide-react';
import { ChartCard, TOOLTIP_STYLE } from './ChartCard.js';

interface SystemMetricsSectionProps {
  readonly history: readonly SystemMetricsDto[];
}

function formatTimeHMS(ts: string): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function getDiskColor(usedPercent: number): string {
  if (usedPercent > 85) return '#EF4444';
  if (usedPercent > 70) return '#EAB308';
  return '#22C55E';
}

export function SystemMetricsSection({ history }: SystemMetricsSectionProps) {
  const latestSnapshot = history.length > 0 ? history[history.length - 1] : null;
  const maxTotalMemory = history.reduce((max, h) => Math.max(max, h.totalMemoryMb), 0);

  // Prepare memory chart data with computed used memory
  const memoryData = history.map((h) => ({
    timestamp: h.timestamp,
    usedMemoryMb: h.totalMemoryMb - h.freeMemoryMb,
    totalMemoryMb: h.totalMemoryMb,
  }));

  // Prepare network chart data (convert bytes to KB/s)
  const networkData = history.map((h) => ({
    timestamp: h.timestamp,
    rxKBps: h.networkRxBytesPerSec / 1024,
    txKBps: h.networkTxBytesPerSec / 1024,
  }));

  // Prepare disk data from latest snapshot
  const diskData: (DiskInfoDto & { label: string })[] = latestSnapshot?.disks
    ? latestSnapshot.disks.map((d) => ({
        ...d,
        label: `${d.usedGb?.toFixed(1) ?? '?'}/${d.totalGb?.toFixed(1) ?? '?'} GB`,
      }))
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* CPU & Load Average */}
      <ChartCard
        title="CPU & 负载"
        icon={<Cpu size={16} className="text-blue-500" />}
        lastValue={latestSnapshot?.cpuUsagePercent != null ? `${latestSnapshot.cpuUsagePercent.toFixed(1)}%` : undefined}
        accentColor={
          (latestSnapshot?.cpuUsagePercent ?? 0) < 80
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-red-600 dark:text-red-400'
        }
      >
        <ResponsiveContainer width="100%" height={192}>
          <ComposedChart data={history as SystemMetricsDto[]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="timestamp" tickFormatter={formatTimeHMS} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <YAxis
              yAxisId="cpu"
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              stroke="#3B82F6"
              label={{ value: 'CPU%', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#3B82F6' }}
            />
            <YAxis
              yAxisId="load"
              orientation="right"
              tick={{ fontSize: 11 }}
              stroke="#F97316"
              label={{ value: 'Load', angle: 90, position: 'insideRight', fontSize: 10, fill: '#F97316' }}
            />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: any, name: any) => {
                const v = Number(value);
                if (name === 'cpuUsagePercent') return [`${v.toFixed(1)}%`, 'CPU 使用率'];
                if (name === 'loadAvg1m') return [v.toFixed(2), '1m 负载'];
                return [v, String(name)];
              }}
            />
            <Area
              yAxisId="cpu"
              type="monotone"
              dataKey="cpuUsagePercent"
              stroke="#3B82F6"
              fill="#3B82F620"
              strokeWidth={2}
            />
            <Line
              yAxisId="load"
              type="monotone"
              dataKey="loadAvg1m"
              stroke="#F97316"
              dot={false}
              strokeWidth={2}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* System Memory */}
      <ChartCard
        title="系统内存"
        icon={<MemoryStick size={16} className="text-purple-500" />}
        lastValue={
          latestSnapshot && latestSnapshot.totalMemoryMb != null && latestSnapshot.freeMemoryMb != null
            ? `${(latestSnapshot.totalMemoryMb - latestSnapshot.freeMemoryMb).toFixed(0)} / ${latestSnapshot.totalMemoryMb.toFixed(0)} MB`
            : undefined
        }
        accentColor="text-purple-600 dark:text-purple-400"
      >
        <ResponsiveContainer width="100%" height={192}>
          <AreaChart data={memoryData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="timestamp" tickFormatter={formatTimeHMS} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <YAxis domain={[0, maxTotalMemory || 'auto']} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: any, name: any) => {
                const v = Number(value);
                if (name === 'usedMemoryMb') return [`${v.toFixed(0)} MB`, '已使用'];
                return [v, String(name)];
              }}
            />
            {maxTotalMemory > 0 && (
              <ReferenceLine
                y={maxTotalMemory}
                stroke="#A855F7"
                strokeDasharray="5 5"
                strokeOpacity={0.5}
                label={{ value: `Total ${maxTotalMemory.toFixed(0)} MB`, fill: '#A855F7', fontSize: 10 }}
              />
            )}
            <Area type="monotone" dataKey="usedMemoryMb" stroke="#A855F7" fill="#A855F720" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Disk Usage */}
      <ChartCard
        title="磁盘使用"
        icon={<HardDrive size={16} className="text-emerald-500" />}
        lastValue={diskData.length > 0 ? `${diskData.length} 挂载点` : undefined}
        accentColor="text-emerald-600 dark:text-emerald-400"
      >
        <ResponsiveContainer width="100%" height={192}>
          {diskData.length > 0 ? (
            <BarChart data={diskData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#9CA3AF" unit="%" />
              <YAxis type="category" dataKey="mount" tick={{ fontSize: 11 }} stroke="#9CA3AF" width={80} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: any, _name: any, props: any) => {
                const v = Number(value);
                  const entry = props.payload as DiskInfoDto & { label: string };
                  return [`${v.toFixed(1)}% (${entry.label})`, '使用率'];
                }}
              />
              <Bar dataKey="usedPercent" radius={[0, 4, 4, 0]}>
                {diskData.map((entry, index) => (
                  <Cell key={`disk-${index}`} fill={getDiskColor(entry.usedPercent)} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <LineChart data={[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </ChartCard>

      {/* Network I/O */}
      <ChartCard
        title="网络 I/O"
        icon={<Network size={16} className="text-cyan-500" />}
        lastValue={
          latestSnapshot?.networkRxBytesPerSec != null
            ? `RX: ${(latestSnapshot.networkRxBytesPerSec / 1024).toFixed(1)} KB/s`
            : undefined
        }
        accentColor="text-cyan-600 dark:text-cyan-400"
      >
        <ResponsiveContainer width="100%" height={192}>
          <LineChart data={networkData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="timestamp" tickFormatter={formatTimeHMS} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: any, name: any) => {
                const v = Number(value);
                if (name === 'rxKBps') return [`${v.toFixed(1)} KB/s`, 'RX KB/s'];
                if (name === 'txKBps') return [`${v.toFixed(1)} KB/s`, 'TX KB/s'];
                return [v, String(name)];
              }}
            />
            <Line type="monotone" dataKey="rxKBps" stroke="#06B6D4" dot={false} strokeWidth={2} name="rxKBps" />
            <Line type="monotone" dataKey="txKBps" stroke="#F97316" dot={false} strokeWidth={2} name="txKBps" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
