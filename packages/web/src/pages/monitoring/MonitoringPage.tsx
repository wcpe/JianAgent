import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useServerStore } from '../../stores/server.store.js';
import { useServerContext } from '../../stores/server-context.store.js';
import { metricsApi } from '../../api/metrics.api.js';
import { alertsApi } from '../../features/alerts/alerts.api.js';
import { useWsChannel } from '../../ws/use-ws-channel.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import type { MetricSnapshotDto, ProbeSnapshotDto, WorldMetricSnapshotDto, PlayerDetailDto, PluginDetailDto, MonitoringOverviewDto, AlertRuleDto, SystemMetricsDto } from '@jian-agent/shared-domain';
import { RefreshCw, Trash2, ChevronDown, ChevronRight, Monitor } from 'lucide-react';
import { StyledSelect } from '../../components/ui/StyledSelect.js';
import { OverviewBanner } from './OverviewBanner.js';
import { StatsBar } from './StatsBar.js';
import { MetricChartsSection } from './MetricChartsSection.js';
import { WorldBreakdownSection, aggregateWorldSummary } from './WorldBreakdownSection.js';
import { PlayerDetailsSection } from './PlayerDetailsSection.js';
import { PluginDetailsSection } from './PluginDetailsSection.js';
import { SystemMetricsSection } from './SystemMetricsSection.js';
import { TimelineCorrelationPanel } from './TimelineCorrelationPanel.js';

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

export function MonitoringPage() {
  const allServers = useServerStore((s) => s.servers);
  const fetchServers = useServerStore((s) => s.fetchServers);
  const servers = allServers.filter((s) => s.serverType !== 'external');
  const contextServerId = useServerContext((s) => s.currentServerId);
  const setCurrentServerId = useServerContext((s) => s.setCurrentServerId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [serverId, setServerIdRaw] = useState(() => searchParams.get('serverId') ?? contextServerId ?? '');
  const setServerId = useCallback((id: string) => {
    setServerIdRaw(id);
    setCurrentServerId(id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) { next.set('serverId', id); } else { next.delete('serverId'); }
      return next;
    }, { replace: true });
  }, [setSearchParams, setCurrentServerId]);
  const [range, setRange] = useState<TimeRange>('1h');
  const [alertRules, setAlertRules] = useState<readonly AlertRuleDto[]>([]);
  const [history, setHistory] = useState<readonly MetricSnapshotDto[]>([]);
  const [worldMetrics, setWorldMetrics] = useState<readonly WorldMetricSnapshotDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [retentionDays, setRetentionDays] = useState(7);
  const [cleaning, setCleaning] = useState(false);
  const realtimeBuffer = useRef<MetricSnapshotDto[]>([]);
  const [playerDetails, setPlayerDetails] = useState<readonly PlayerDetailDto[]>([]);
  const [pluginDetails, setPluginDetails] = useState<readonly PluginDetailDto[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ players: true, plugins: false, system: true });
  const [overview, setOverview] = useState<MonitoringOverviewDto | null>(null);
  const [systemHistory, setSystemHistory] = useState<SystemMetricsDto[]>([]);
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null);
  const systemRealtimeBuffer = useRef<SystemMetricsDto[]>([]);

  useEffect(() => { fetchServers(); }, [fetchServers]);

  useEffect(() => {
    if (servers.length > 0 && !serverId) setServerId(servers[0].id);
  }, [servers, serverId, setServerId]);

  useEffect(() => {
    alertsApi.listRules().then(setAlertRules).catch(() => setAlertRules([]));
  }, []);

  const loadHistory = useCallback(async () => {
    if (!serverId) return;
    setLoading(true);
    try {
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - RANGE_MS[range]).toISOString();
      const limit = range === '7d' ? 500 : range === '24h' ? 300 : 120;

      const [histRes, worldRes, overviewRes, sysHistRes] = await Promise.all([
        metricsApi.getHistory({ serverId, startTime, endTime, limit }),
        metricsApi.getWorldMetrics({ serverId, startTime, endTime, limit: limit * 3 }),
        metricsApi.getOverview(serverId),
        metricsApi.getSystemHistory({ startTime, endTime, limit: 120 }),
      ]);

      const data = Array.isArray(histRes) ? histRes : [];
      setHistory(data);
      realtimeBuffer.current = [...data];
      setWorldMetrics(Array.isArray(worldRes) ? worldRes : []);
      setOverview(overviewRes);
      const sysData = Array.isArray(sysHistRes) ? sysHistRes : [];
      setSystemHistory(sysData);
      systemRealtimeBuffer.current = [...sysData];
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
      setSystemHistory([]);
      systemRealtimeBuffer.current = [];
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

  const handleSystemMetrics = useCallback(
    (payload: SystemMetricsDto) => {
      systemRealtimeBuffer.current = [...systemRealtimeBuffer.current, payload].slice(-360);
      setSystemHistory([...systemRealtimeBuffer.current]);
    },
    [],
  );

  useWsChannel('system:metrics', handleSystemMetrics);

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
  const worldSummary = aggregateWorldSummary(worldMetrics);
  const maxMem = lastPoint?.maxMemoryMb;

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">服务器监控</h1>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/75 dark:bg-gray-900/55 backdrop-blur-xl p-3 shadow-lg">
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
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white/85 dark:bg-gray-900/65 border border-white/55 dark:border-primary-300/20 rounded-lg hover:bg-white dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50 active:scale-95"
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
            className="flex items-center gap-1 px-2 py-1 text-xs bg-danger-100 dark:bg-danger-700/30 text-danger-700 dark:text-danger-400 rounded hover:bg-danger-200 dark:hover:bg-danger-700/50 transition-colors disabled:opacity-50 active:scale-95"
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

      {overview && <OverviewBanner overview={overview} />}

      <StatsBar lastPoint={lastPoint} maxMem={maxMem} worldSummaryCount={worldSummary.length} />

      {history.length === 0 && !loading && (
        <p className="text-center text-gray-400 dark:text-gray-500 py-12">
          暂无数据。请确保探针已连接并等待数据采集。
        </p>
      )}

      <MetricChartsSection
        history={history}
        lastPoint={lastPoint}
        maxMem={maxMem}
        worldSummaryCount={worldSummary.length}
        alertRules={alertRules}
        onChartClick={(timestamp: string) => setSelectedTimestamp(timestamp)}
      />

      {/* Host System Metrics */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => toggleSection('system')}
          className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {expandedSections.system ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <Monitor size={18} className="text-blue-500" />
          主机系统
        </button>
        {expandedSections.system && (
          systemHistory.length > 0 ? (
            <SystemMetricsSection history={systemHistory} />
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">暂无主机系统数据</p>
          )
        )}
      </div>

      <WorldBreakdownSection worldMetrics={worldMetrics} />

      <PlayerDetailsSection
        playerDetails={playerDetails}
        expanded={expandedSections.players ?? false}
        onToggle={() => toggleSection('players')}
      />

      <PluginDetailsSection
        pluginDetails={pluginDetails}
        expanded={expandedSections.plugins ?? false}
        onToggle={() => toggleSection('plugins')}
      />

      <TimelineCorrelationPanel
        serverId={serverId}
        selectedTimestamp={selectedTimestamp}
        onClose={() => setSelectedTimestamp(null)}
      />
    </div>
  );
}
