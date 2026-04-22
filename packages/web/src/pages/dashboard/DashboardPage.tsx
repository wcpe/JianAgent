import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ServerStatusBadge } from '../../components/status/ServerStatusBadge.js';
import { useServerStore } from '../../stores/server.store.js';
import { useWsChannel } from '../../ws/use-ws-channel.js';
import { botApi } from '../../api/bot.api.js';
import { sessionApi } from '../../api/session.api.js';
import { alertsApi } from '../../features/alerts/alerts.api.js';
import type { BotStats } from '../../api/bot.api.js';
import type { ServerStatusPayload } from '@jian-agent/shared-protocol';
import type { AlertSummaryDto, ServerWithStatusDto } from '@jian-agent/shared-domain';

interface AggregateData {
  readonly botStatsByServer: Record<string, BotStats>;
  readonly sessionCount: number;
  readonly alertSummary: AlertSummaryDto | null;
}

const INITIAL: AggregateData = { botStatsByServer: {}, sessionCount: 0, alertSummary: null };

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
      const [sessRes, alertRes] = await Promise.allSettled([sessionApi.list(), alertsApi.getSummary()]);
      const sessions = sessRes.status === 'fulfilled' ? sessRes.value : null;
      const sessionList = Array.isArray(sessions) ? sessions : (sessions as { data?: unknown[] } | null)?.data ?? [];
      setData((p) => ({
        ...p,
        sessionCount: sessionList.length,
        alertSummary: alertRes.status === 'fulfilled' ? alertRes.value : null,
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

  const running = servers.filter((s) => s.runtimeStatus === 'running').length;
  const errored = servers.filter((s) => s.runtimeStatus === 'error').length;
  const bots = botTotals(data.botStatsByServer);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Dashboard</h1>

      {/* ── Aggregation Stats Bar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {([
          { label: '服务器总数', value: servers.length, sub: `运行 ${running} / 异常 ${errored}`, accent: undefined },
          { label: '运行中', value: running, sub: undefined, accent: 'text-green-600 dark:text-green-400' as string | undefined },
          { label: '异常', value: errored, sub: undefined, accent: errored > 0 ? 'text-red-600 dark:text-red-400' : undefined },
          { label: 'Bot 总数', value: bots.total, sub: `在线 ${bots.online} / 异常 ${bots.error}`, accent: undefined },
        ]).map((m) => (
          <div key={m.label} className="bg-white/80 dark:bg-slate-900/60 rounded-2xl shadow-xl border border-white/55 dark:border-primary-300/20 backdrop-blur-xl p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">{m.label}</p>
            <p className={`text-2xl font-semibold ${m.accent ?? 'text-gray-900 dark:text-gray-100'}`}>{m.value}</p>
            {m.sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{m.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Server Card Grid ── */}
      <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">服务器列表</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {servers.map((sv) => {
          const svBots = data.botStatsByServer[sv.id];
          return (
            <button
              key={sv.id}
              type="button"
              onClick={() => navigate(`/servers/${sv.id}/terminal`)}
              className="bg-white/80 dark:bg-slate-900/60 rounded-2xl border border-white/55 dark:border-primary-300/20 shadow-xl backdrop-blur-xl p-4 text-left hover:ring-2 hover:ring-primary-400 transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{sv.name}</span>
                <ServerStatusBadge state={sv.runtimeStatus?.toUpperCase() ?? 'STOPPED'} />
              </div>
              <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                {sv.pid != null && <p>PID: {sv.pid}</p>}
                {sv.uptime != null && <p>运行时长: {formatUptime(sv.uptime)}</p>}
                {svBots && (
                  <p>
                    Bot: <span className="text-green-600 dark:text-green-400">{svBots.online}</span>
                    {' / '}{svBots.total}
                    {svBots.error > 0 && <span className="text-red-600 dark:text-red-400 ml-1">({svBots.error} err)</span>}
                  </p>
                )}
              </div>
            </button>
          );
        })}
        {servers.length === 0 && <p className="text-gray-400 col-span-full">暂无服务器</p>}
      </div>

      {/* ── Bottom: Alert Summary + Sessions ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/80 dark:bg-slate-900/60 rounded-2xl border border-white/55 dark:border-primary-300/20 shadow-xl backdrop-blur-xl p-4">
          <h2 className="text-sm text-gray-500 dark:text-gray-400 mb-2">告警摘要</h2>
          {data.alertSummary ? (
            <div className="flex flex-wrap gap-3">
              <span className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                CRITICAL: {data.alertSummary.criticalCount ?? 0}
              </span>
              <span className="text-xs px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                WARNING: {data.alertSummary.warningCount ?? 0}
              </span>
              <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                INFO: {data.alertSummary.infoCount ?? 0}
              </span>
            </div>
          ) : (
            <p className="text-gray-400">—</p>
          )}
        </div>

        <div className="bg-white/80 dark:bg-slate-900/60 rounded-2xl border border-white/55 dark:border-primary-300/20 shadow-xl backdrop-blur-xl p-4">
          <h2 className="text-sm text-gray-500 dark:text-gray-400 mb-2">会话概览</h2>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{data.sessionCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">活跃会话数</p>
        </div>
      </div>
    </div>
  );
}
