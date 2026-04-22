import { useEffect, useState, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, ReferenceLine,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useServerStore } from '../../stores/server.store.js';
import { metricsApi } from '../../api/metrics.api.js';
import { useWsChannel } from '../../ws/use-ws-channel.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import type { MetricSnapshotDto, ProbeSnapshotDto, WorldMetricSnapshotDto, PlayerDetailDto, PluginDetailDto, MonitoringOverviewDto } from '@jian-agent/shared-domain';
import { Activity, Users, HardDrive, Cpu, RefreshCw, Globe, Plug, Trash2, ChevronDown, ChevronRight, Heart, Sword, Package, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { StyledSelect } from '../../components/ui/StyledSelect.js';

type TimeRange = '1h' | '6h' | '24h' | '7d';

const RANGE_MS: Record<TimeRange, number> = {
  '1h': 3_600_000,
  '6h': 21_600_000,
  '24h': 86_400_000,
  '7d': 604_800_000,
};

const RANGE_LABELS: Record<TimeRange, string> = {
  '1h': '1 小时',
  '6h': '6 小时',
  '24h': '24 小时',
  '7d': '7 天',
};

const MAX_REALTIME_POINTS = 300;

const PIE_COLORS = [
  '#22C55E', '#3B82F6', '#EAB308', '#EF4444', '#A855F7',
  '#06B6D4', '#F97316', '#EC4899', '#14B8A6', '#8B5CF6',
  '#F43F5E', '#10B981', '#6366F1', '#D946EF', '#0EA5E9',
];

function formatTime(ts: string): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const TOOLTIP_STYLE = { backgroundColor: '#1F2937', border: 'none', borderRadius: 8, color: '#F3F4F6' };

interface ChartCardProps {
  readonly title: string;
  readonly icon: React.ReactNode;
  readonly children: React.ReactNode;
  readonly lastValue?: string;
  readonly accentColor?: string;
  readonly tall?: boolean;
}

function ChartCard({ title, icon, children, lastValue, accentColor, tall }: ChartCardProps) {
  return (
    <div className="bg-white/80 dark:bg-slate-900/60 rounded-2xl border border-white/55 dark:border-primary-300/20 shadow-xl backdrop-blur-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
        </div>
        {lastValue && (
          <span className={`text-lg font-bold ${accentColor ?? 'text-gray-900 dark:text-gray-100'}`}>
            {lastValue}
          </span>
        )}
      </div>
      <div style={{ minHeight: tall ? 256 : 192 }}>{children}</div>
    </div>
  );
}

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

function aggregateWorldSummary(worlds: readonly WorldMetricSnapshotDto[]): { worldName: string; entities: number; chunks: number }[] {
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

export function MonitoringPage() {
  const allServers = useServerStore((s) => s.servers);
  const fetchServers = useServerStore((s) => s.fetchServers);
  const servers = allServers.filter((s) => s.serverType !== 'external');
  const [serverId, setServerId] = useState('');
  const [range, setRange] = useState<TimeRange>('1h');
  const [history, setHistory] = useState<readonly MetricSnapshotDto[]>([]);
  const [worldMetrics, setWorldMetrics] = useState<readonly WorldMetricSnapshotDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [retentionDays, setRetentionDays] = useState(7);
  const [cleaning, setCleaning] = useState(false);
  const realtimeBuffer = useRef<MetricSnapshotDto[]>([]);
  const [playerDetails, setPlayerDetails] = useState<readonly PlayerDetailDto[]>([]);
  const [pluginDetails, setPluginDetails] = useState<readonly PluginDetailDto[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ players: true, plugins: false });
  const [overview, setOverview] = useState<MonitoringOverviewDto | null>(null);

  useEffect(() => { fetchServers(); }, [fetchServers]);

  useEffect(() => {
    if (servers.length > 0 && !serverId) setServerId(servers[0].id);
  }, [servers, serverId]);

  const loadHistory = useCallback(async () => {
    if (!serverId) return;
    setLoading(true);
    try {
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - RANGE_MS[range]).toISOString();
      const limit = range === '7d' ? 500 : range === '24h' ? 300 : 120;

      const [histRes, worldRes, overviewRes] = await Promise.all([
        metricsApi.getHistory({ serverId, startTime, endTime, limit }),
        metricsApi.getWorldMetrics({ serverId, startTime, endTime, limit: limit * 3 }),
        metricsApi.getOverview(serverId),
      ]);

      const data = Array.isArray(histRes) ? histRes : [];
      setHistory(data);
      realtimeBuffer.current = [...data];
      setWorldMetrics(Array.isArray(worldRes) ? worldRes : []);
      setOverview(overviewRes);
      // Extract latest player/plugin details from history
      if (data.length > 0) {
        const latestSnap = data[data.length - 1];
        if (latestSnap.playerDetails) setPlayerDetails(latestSnap.playerDetails);
        if (latestSnap.pluginDetails) setPluginDetails(latestSnap.pluginDetails);
      }
    } catch {
      setHistory([]);
      realtimeBuffer.current = [];
      setWorldMetrics([]);
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [serverId, range]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleSnapshot = useCallback(
    (payload: ProbeSnapshotDto & { serverId?: string }) => {
      const snapServerId = payload.serverId ?? serverId;
      if (snapServerId !== serverId) return;

      // Update detailed info from realtime snapshot
      if (payload.players) setPlayerDetails(payload.players);
      if (payload.plugins) setPluginDetails(payload.plugins);

      const usedMemory = (payload.totalMemoryMb ?? 0) - (payload.freeMemoryMb ?? 0);
      const cpuUsage = (payload.cpuUsage != null && payload.cpuUsage >= 0) ? payload.cpuUsage : null;

      const point: MetricSnapshotDto = {
        id: `rt-${Date.now()}`,
        timestamp: payload.timestamp ?? new Date().toISOString(),
        serverId,
        tps: payload.tps ?? null,
        mspt: payload.mspt ?? null,
        onlinePlayers: payload.onlinePlayers ?? null,
        onlineBots: null,
        cpuUsage,
        memoryUsageMb: usedMemory,
        maxMemoryMb: payload.maxMemoryMb ?? null,
        entityCount: payload.entityCount ?? null,
        loadedChunks: payload.loadedChunks ?? null,
        worldCount: payload.worldCount ?? null,
        maxPlayers: payload.maxPlayers ?? null,
        pluginCount: payload.pluginCount ?? null,
        playerDetails: null,
        pluginDetails: null,
      };

      realtimeBuffer.current = [...realtimeBuffer.current, point].slice(-MAX_REALTIME_POINTS);
      setHistory([...realtimeBuffer.current]);
    },
    [serverId],
  );

  useWsChannel('resource:plugin:snapshot', handleSnapshot);

  const handleCleanup = useCallback(async () => {
    setCleaning(true);
    try {
      await metricsApi.cleanupMetrics(retentionDays);
      await loadHistory();
      useDialogStore.getState().showToast(`已清理 ${retentionDays} 天前的数据`, 'success');
    } catch (err: any) {
      useDialogStore.getState().showToast(err.message ?? '清理失败', 'error');
    } finally {
      setCleaning(false);
    }
  }, [retentionDays, loadHistory]);

  const lastPoint = history.length > 0 ? history[history.length - 1] : null;
  const entityTypeData = aggregateEntityTypes(worldMetrics);
  const worldSummary = aggregateWorldSummary(worldMetrics);
  const maxMem = lastPoint?.maxMemoryMb;

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">服务器监控</h1>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/75 dark:bg-slate-900/55 backdrop-blur-xl p-3 shadow-lg">
        <StyledSelect
          value={serverId}
          onChange={(e) => setServerId(e.target.value)}
          className="w-auto"
        >
          {servers.map((sv) => (
            <option key={sv.id} value={sv.id}>{sv.name}</option>
          ))}
        </StyledSelect>

        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          {(Object.keys(RANGE_MS) as TimeRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                range === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={loadHistory}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white/85 dark:bg-slate-900/65 border border-white/55 dark:border-primary-300/20 rounded-lg hover:bg-white dark:hover:bg-slate-900 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50 active:scale-95"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>

        {/* Data Retention */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-500 dark:text-gray-400">保留</span>
          <input
            type="number"
            min={1}
            max={365}
            value={retentionDays}
            onChange={(e) => setRetentionDays(Math.max(1, parseInt(e.target.value, 10) || 7))}
            className="w-16 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">天</span>
          <button
            type="button"
            onClick={handleCleanup}
            disabled={cleaning}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 active:scale-95"
          >
            <Trash2 size={12} />
            清理
          </button>
        </div>

        {lastPoint && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            最后更新: {new Date(lastPoint.timestamp).toLocaleString()}
          </span>
        )}
      </div>

      {overview && (
        <div className="mb-6 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white shadow-2xl p-4 md:p-5">
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
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
        {([
          { label: 'TPS', value: lastPoint?.tps?.toFixed(1) ?? '—', color: (lastPoint?.tps ?? 20) >= 18 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' },
          { label: 'MSPT', value: lastPoint?.mspt?.toFixed(1) ?? '—', color: (lastPoint?.mspt ?? 0) <= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' },
          { label: 'CPU', value: lastPoint?.cpuUsage != null ? `${lastPoint.cpuUsage.toFixed(1)}%` : '—', color: (lastPoint?.cpuUsage ?? 0) < 80 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400' },
          { label: '在线玩家', value: `${lastPoint?.onlinePlayers ?? 0}/${lastPoint?.maxPlayers ?? '?'}`, color: 'text-blue-600 dark:text-blue-400' },
          { label: '内存 (MB)', value: lastPoint?.memoryUsageMb != null ? `${lastPoint.memoryUsageMb.toFixed(0)}/${maxMem?.toFixed(0) ?? '?'}` : '—', color: 'text-purple-600 dark:text-purple-400' },
          { label: '世界数', value: String(lastPoint?.worldCount ?? (worldSummary.length || '—')), color: 'text-teal-600 dark:text-teal-400' },
          { label: '插件数', value: String(lastPoint?.pluginCount ?? '—'), color: 'text-orange-600 dark:text-orange-400' },
        ]).map((m) => (
          <div key={m.label} className="bg-white/80 dark:bg-slate-900/60 rounded-2xl border border-white/55 dark:border-primary-300/20 shadow-xl backdrop-blur-xl px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{m.label}</p>
            <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {history.length === 0 && !loading && (
        <p className="text-center text-gray-400 dark:text-gray-500 py-12">
          暂无数据。请确保探针已连接并等待数据采集。
        </p>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TPS Chart */}
        <ChartCard
          title="TPS"
          icon={<Activity size={16} className="text-green-500" />}
          lastValue={lastPoint?.tps?.toFixed(1)}
          accentColor={(lastPoint?.tps ?? 20) >= 18 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
        >
          <ResponsiveContainer width="100%" height={192}>
            <LineChart data={history as MetricSnapshotDto[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
              <YAxis domain={[0, 22]} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
              <Tooltip labelFormatter={(v) => new Date(v as string).toLocaleString()} contentStyle={TOOLTIP_STYLE} />
              <ReferenceLine y={20} stroke="#22C55E" strokeDasharray="5 5" strokeOpacity={0.5} />
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
            <AreaChart data={history as MetricSnapshotDto[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
              <Tooltip labelFormatter={(v) => new Date(v as string).toLocaleString()} contentStyle={TOOLTIP_STYLE} />
              <ReferenceLine y={50} stroke="#EF4444" strokeDasharray="5 5" strokeOpacity={0.5} />
              <Area type="monotone" dataKey="mspt" stroke="#EAB308" fill="#EAB30820" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* CPU Usage Chart */}
        <ChartCard
          title="CPU 使用率 (%)"
          icon={<Cpu size={16} className="text-rose-500" />}
          lastValue={lastPoint?.cpuUsage != null ? `${lastPoint.cpuUsage.toFixed(1)}%` : '—'}
          accentColor={(lastPoint?.cpuUsage ?? 0) < 80 ? 'text-rose-600 dark:text-rose-400' : 'text-red-600 dark:text-red-400'}
        >
          <ResponsiveContainer width="100%" height={192}>
            <AreaChart data={history as MetricSnapshotDto[]}>
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
            <AreaChart data={history as MetricSnapshotDto[]}>
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
          lastValue={lastPoint?.memoryUsageMb != null ? `${lastPoint.memoryUsageMb.toFixed(0)} MB` : '—'}
          accentColor="text-purple-600 dark:text-purple-400"
        >
          <ResponsiveContainer width="100%" height={192}>
            <AreaChart data={history as MetricSnapshotDto[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
              <Tooltip labelFormatter={(v) => new Date(v as string).toLocaleString()} contentStyle={TOOLTIP_STYLE} />
              {maxMem && <ReferenceLine y={maxMem} stroke="#EF4444" strokeDasharray="5 5" strokeOpacity={0.5} label={{ value: `Max ${maxMem.toFixed(0)}`, fill: '#EF4444', fontSize: 10 }} />}
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
            <LineChart data={history as MetricSnapshotDto[]}>
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
            <LineChart data={history as MetricSnapshotDto[]}>
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
          lastValue={String(lastPoint?.worldCount ?? (worldSummary.length || '—'))}
          accentColor="text-teal-600 dark:text-teal-400"
        >
          <ResponsiveContainer width="100%" height={192}>
            <LineChart data={history as MetricSnapshotDto[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" allowDecimals={false} />
              <Tooltip labelFormatter={(v) => new Date(v as string).toLocaleString()} contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="worldCount" stroke="#14B8A6" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* World Breakdown Section */}
      {worldSummary.length > 0 && (
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
      )}

      {/* Player Details Section */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => toggleSection('players')}
          className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {expandedSections.players ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <Users size={18} className="text-blue-500" />
          在线玩家详情 ({playerDetails.length})
        </button>
        {expandedSections.players && (
          playerDetails.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-2 text-left">玩家</th>
                    <th className="px-4 py-2 text-left">生命值</th>
                    <th className="px-4 py-2 text-left">饱食度</th>
                    <th className="px-4 py-2 text-left">等级</th>
                    <th className="px-4 py-2 text-left">游戏模式</th>
                    <th className="px-4 py-2 text-left">世界</th>
                    <th className="px-4 py-2 text-left">坐标</th>
                    <th className="px-4 py-2 text-left">延迟</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {playerDetails.map((p) => (
                    <tr key={p.uuid} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{p.name}</td>
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-1">
                          <Heart size={12} className="text-red-500" />
                          {p.health.toFixed(1)}/{p.maxHealth.toFixed(0)}
                        </span>
                      </td>
                      <td className="px-4 py-2">{p.food}</td>
                      <td className="px-4 py-2">{p.level}</td>
                      <td className="px-4 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          p.gameMode === 'SURVIVAL' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                          p.gameMode === 'CREATIVE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                          p.gameMode === 'ADVENTURE' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {p.gameMode}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{p.world}</td>
                      <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {p.x.toFixed(0)}, {p.y.toFixed(0)}, {p.z.toFixed(0)}
                      </td>
                      <td className="px-4 py-2">
                        <span className={p.ping < 100 ? 'text-green-600 dark:text-green-400' : p.ping < 300 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}>
                          {p.ping >= 0 ? `${p.ping}ms` : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">暂无在线玩家</p>
          )
        )}
      </div>

      {/* Plugin Details Section */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => toggleSection('plugins')}
          className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {expandedSections.plugins ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <Package size={18} className="text-orange-500" />
          插件列表 ({pluginDetails.length})
        </button>
        {expandedSections.plugins && (
          pluginDetails.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-2 text-left">插件名称</th>
                    <th className="px-4 py-2 text-left">版本</th>
                    <th className="px-4 py-2 text-left">状态</th>
                    <th className="px-4 py-2 text-left">作者</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {pluginDetails.map((pl) => (
                    <tr key={pl.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{pl.name}</td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{pl.version}</td>
                      <td className="px-4 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          pl.enabled
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {pl.enabled ? '已启用' : '已禁用'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">
                        {pl.authors.join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">暂无插件数据</p>
          )
        )}
      </div>
    </div>
  );
}
