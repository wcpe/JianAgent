import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Bot, FlaskConical, ArrowRight, Play, Square, RotateCw } from 'lucide-react';
import { ServerStatusBadge } from '../../components/status/ServerStatusBadge.js';
import { useServerStore } from '../../stores/server.store.js';
import { useWsChannel } from '../../ws/use-ws-channel.js';
import { botApi } from '../../api/bot.api.js';
import { sessionApi } from '../../api/session.api.js';
import { alertsApi } from '../../features/alerts/alerts.api.js';
import { serverLifecycleApi } from '../../api/server-lifecycle.api.js';
import { metricsApi } from '../../api/metrics.api.js';
import type { BotStats } from '../../api/bot.api.js';
import type { ServerStatusPayload } from '@jian-agent/shared-protocol';
import type { AlertDto, AlertSummaryDto, ServerWithStatusDto, SystemMetricsDto } from '@jian-agent/shared-domain';
import { ServerHealthGrid } from './ServerHealthGrid.js';
import { ServerSetupWizard } from '../servers/ServerSetupWizard.js';

interface AggregateData {
  readonly botStatsByServer: Record<string, BotStats>;
  readonly sessionCount: number;
  readonly alertSummary: AlertSummaryDto | null;
  readonly recentAlerts: AlertDto[];
  readonly healthByServer: Record<string, string>;
  readonly systemMetrics: SystemMetricsDto | null;
}

const INITIAL: AggregateData = { botStatsByServer: {}, sessionCount: 0, alertSummary: null, recentAlerts: [], healthByServer: {}, systemMetrics: null };

function formatUptime(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function botTotals(map: Record<string, BotStats>) {
  let total = 0, online = 0, error = 0;
  for (const s of Object.values(map)) {
    total += s.total; online += s.online; error += s.error;
  }
  return { total, online, error };
}

export function DashboardPage() {
  const servers = useServerStore((s) => s.servers);
  const fetchServers = useServerStore((s) => s.fetchServers);
  const patchServerStatus = useServerStore((s) => s.patchServerStatus);
  const [data, setData] = useState<AggregateData>(INITIAL);
  const [wizardOpen, setWizardOpen] = useState(false);
  const navigate = useNavigate();

  /* ---- WS: real-time server status ---- */
  const handleServerStatus = useCallback(
    (payload: ServerStatusPayload & { serverId?: string }) => {
      const id = payload.serverId ?? servers[0]?.id;
      if (id) patchServerStatus(id, { runtimeStatus: payload.state?.toLowerCase() as ServerWithStatusDto['runtimeStatus'] });
    },
    [patchServerStatus, servers],
  );
  useWsChannel('resource:server:status', handleServerStatus);

  /* ---- WS: alert refresh ---- */
  const handleAlertFired = useCallback(() => {
    alertsApi.getSummary().then((s) => setData((p) => ({ ...p, alertSummary: s }))).catch(() => {});
  }, []);
  useWsChannel('alert:fired', handleAlertFired);

  /* ---- Initial data load ---- */
  useEffect(() => {
    fetchServers();
    const load = async () => {
      const [sessRes, alertRes, recentRes, sysRes] = await Promise.allSettled([
        sessionApi.list(),
        alertsApi.getSummary(),
        alertsApi.listAlerts(5),
        metricsApi.getSystemLatest(),
      ]);
      const sessions = sessRes.status === 'fulfilled' ? sessRes.value : null;
      const sessionList = Array.isArray(sessions) ? sessions : (sessions as { data?: unknown[] } | null)?.data ?? [];
      setData((p) => ({
        ...p,
        sessionCount: sessionList.length,
        alertSummary: alertRes.status === 'fulfilled' ? alertRes.value : null,
        recentAlerts: recentRes.status === 'fulfilled' ? recentRes.value : [],
        systemMetrics: sysRes.status === 'fulfilled' ? sysRes.value : null,
      }));
    };
    load();
  }, [fetchServers]);

  /* ---- Fetch bot stats per server when servers change ---- */
  useEffect(() => {
    if (servers.length === 0) return;
    const load = async () => {
      const results = await Promise.allSettled(servers.map((sv) => botApi.stats(sv.id)));
      const map: Record<string, BotStats> = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') map[servers[i].id] = r.value.data;
      });
      setData((p) => ({ ...p, botStatsByServer: map }));
    };
    load();
  }, [servers]);

  /* ---- Fetch health overview for running servers ---- */
  useEffect(() => {
    const running = servers.filter((s) => s.runtimeStatus === 'running');
    if (running.length === 0) return;
    const load = async () => {
      const results = await Promise.allSettled(running.map((sv) => metricsApi.getOverview(sv.id)));
      const healthMap: Record<string, string> = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value) {
          healthMap[running[i].id] = (r.value as any).state ?? 'unknown';
        }
      });
      setData((p) => ({ ...p, healthByServer: { ...p.healthByServer, ...healthMap } }));
    };
    load();
  }, [servers]);

  const handleServerAction = async (e: React.MouseEvent, id: string, action: 'start' | 'stop' | 'restart') => {
    e.stopPropagation();
    try {
      if (action === 'start') await serverLifecycleApi.startServer(id);
      else if (action === 'stop') await serverLifecycleApi.stopServer(id);
      else await serverLifecycleApi.restartServer(id);
      fetchServers();
    } catch { /* toast handled by apiFetch */ }
  };

  const running = servers.filter((s) => s.runtimeStatus === 'running').length;
  const errored = servers.filter((s) => s.runtimeStatus === 'error').length;
  const bots = botTotals(data.botStatsByServer);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Dashboard</h1>

      {/* ── Quick Actions ── */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">快速操作</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {([
          { label: '添加服务器', icon: Server, action: () => setWizardOpen(true) },
          { label: '创建机器人', icon: Bot, action: () => navigate('/bots') },
          { label: '开始压测', icon: FlaskConical, action: () => navigate('/sessions/new') },
        ] as const).map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            className="bg-white/80 dark:bg-gray-900/60 rounded-2xl border border-white/55 dark:border-primary-300/20 shadow-xl backdrop-blur-xl p-4 flex items-center gap-3 hover:ring-2 hover:ring-primary-400 transition-shadow text-left"
          >
            <item.icon size={24} className="text-gray-600 dark:text-gray-300 shrink-0" />
            <span className="font-medium text-gray-900 dark:text-gray-100 flex-1">{item.label}</span>
            <ArrowRight size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />
          </button>
        ))}
      </div>

      {/* ── Aggregation Stats Bar ── */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">系统状态</p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {([
          { label: '服务器总数', value: servers.length, sub: `运行 ${running} / 异常 ${errored}`, accent: undefined },
          { label: '运行中', value: running, sub: undefined, accent: 'text-success-600 dark:text-success-400' as string | undefined },
          { label: '异常', value: errored, sub: undefined, accent: errored > 0 ? 'text-danger-600 dark:text-danger-400' : undefined },
          { label: 'Bot 总数', value: bots.total, sub: `在线 ${bots.online} / 异常 ${bots.error}`, accent: undefined },
          { label: '主机 CPU', value: data.systemMetrics?.cpuUsagePercent != null ? `${data.systemMetrics.cpuUsagePercent.toFixed(0)}%` : '—', sub: data.systemMetrics?.loadAvg1m != null ? `负载 ${data.systemMetrics.loadAvg1m.toFixed(2)}` : undefined, accent: data.systemMetrics?.cpuUsagePercent != null && data.systemMetrics.cpuUsagePercent > 80 ? 'text-danger-600 dark:text-danger-400' : undefined },
          { label: '磁盘', value: (() => { const d = data.systemMetrics?.disks?.[0]; return d ? `${d.usedPercent.toFixed(0)}%` : '—'; })(), sub: (() => { const d = data.systemMetrics?.disks?.[0]; return d ? `${d.usedGb.toFixed(1)}/${d.totalGb.toFixed(1)} GB (${d.mount})` : undefined; })(), accent: (() => { const d = data.systemMetrics?.disks?.[0]; return d && d.usedPercent > 85 ? 'text-danger-600 dark:text-danger-400' : undefined; })() },
        ]).map((m) => (
          <div key={m.label} className="bg-white/80 dark:bg-gray-900/60 rounded-2xl shadow-xl border border-white/55 dark:border-primary-300/20 backdrop-blur-xl p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">{m.label}</p>
            <p className={`text-2xl font-semibold ${m.accent ?? 'text-gray-900 dark:text-gray-100'}`}>{m.value}</p>
            {m.sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{m.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Server Card Grid ── */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">服务器</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {servers.map((sv) => {
          const svBots = data.botStatsByServer[sv.id];
          const health = data.healthByServer[sv.id];
          const isRunning = sv.runtimeStatus === 'running';
          const isStopped = sv.runtimeStatus === 'stopped' || sv.runtimeStatus === 'unknown' || !sv.runtimeStatus;
          return (
            <button
              key={sv.id}
              type="button"
              onClick={() => navigate(`/servers/${sv.id}/terminal`)}
              className="bg-white/80 dark:bg-gray-900/60 rounded-2xl border border-white/55 dark:border-primary-300/20 shadow-xl backdrop-blur-xl p-4 text-left hover:ring-2 hover:ring-primary-400 transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isRunning && health && (
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      health === 'healthy' ? 'bg-green-500' :
                      health === 'degraded' ? 'bg-yellow-500' :
                      health === 'critical' ? 'bg-red-500' : 'bg-gray-400'
                    }`} title={health} />
                  )}
                  <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{sv.name}</span>
                </div>
                <ServerStatusBadge state={sv.runtimeStatus?.toUpperCase() ?? 'STOPPED'} />
              </div>
              <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                {sv.pid != null && <p>PID: {sv.pid}</p>}
                {sv.uptime != null && <p>运行时长: {formatUptime(sv.uptime)}</p>}
                {svBots && (
                  <p>
                    Bot: <span className="text-success-600 dark:text-success-400">{svBots.online}</span>
                    {' / '}{svBots.total}
                    {svBots.error > 0 && <span className="text-danger-600 dark:text-danger-400 ml-1">({svBots.error} err)</span>}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                {isStopped && (
                  <button type="button" onClick={(e) => handleServerAction(e, sv.id, 'start')}
                    className="p-1.5 rounded-lg text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors" title="启动">
                    <Play size={14} />
                  </button>
                )}
                {isRunning && (
                  <>
                    <button type="button" onClick={(e) => handleServerAction(e, sv.id, 'stop')}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors" title="停止">
                      <Square size={14} />
                    </button>
                    <button type="button" onClick={(e) => handleServerAction(e, sv.id, 'restart')}
                      className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors" title="重启">
                      <RotateCw size={14} />
                    </button>
                  </>
                )}
              </div>
            </button>
          );
        })}
        {servers.length === 0 && (
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-8 text-center col-span-full">
            <Server size={40} className="mx-auto text-gray-400 dark:text-gray-500 mb-3" />
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1">还没有服务器</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">添加你的第一台服务器开始使用</p>
            <button
              type="button"
              onClick={() => navigate('/resources')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              添加服务器
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom: Alert Summary + Sessions ── */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">运营概况</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/80 dark:bg-gray-900/60 rounded-2xl border border-white/55 dark:border-primary-300/20 shadow-xl backdrop-blur-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm text-gray-500 dark:text-gray-400">告警摘要</h2>
            <button type="button" onClick={() => navigate('/alerts')} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">查看全部</button>
          </div>
          {data.alertSummary ? (
            <div className="flex flex-wrap gap-3 mb-3">
              <span className="text-xs px-2 py-1 rounded bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300">
                CRITICAL: {data.alertSummary.criticalCount ?? 0}
              </span>
              <span className="text-xs px-2 py-1 rounded bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300">
                WARNING: {data.alertSummary.warningCount ?? 0}
              </span>
              <span className="text-xs px-2 py-1 rounded bg-info-100 dark:bg-info-900/30 text-info-700 dark:text-info-300">
                INFO: {data.alertSummary.infoCount ?? 0}
              </span>
            </div>
          ) : (
            <p className="text-gray-400 mb-3">—</p>
          )}
          {data.recentAlerts.length > 0 && (
            <div className="space-y-1.5 border-t border-gray-200 dark:border-gray-700 pt-2">
              {data.recentAlerts.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    a.level === 'CRITICAL' ? 'bg-red-500' : a.level === 'WARNING' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <span className="text-gray-500 dark:text-gray-400 shrink-0">{new Date(a.timestamp).toLocaleTimeString()}</span>
                  <span className="text-gray-700 dark:text-gray-300 truncate">{a.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white/80 dark:bg-gray-900/60 rounded-2xl border border-white/55 dark:border-primary-300/20 shadow-xl backdrop-blur-xl p-4">
          <h2 className="text-sm text-gray-500 dark:text-gray-400 mb-2">会话概览</h2>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{data.sessionCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">活跃会话数</p>
        </div>
      </div>

      {/* ── Server Health Grid ── */}
      <div className="mt-6">
        <ServerHealthGrid servers={servers} />
      </div>

      <ServerSetupWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
