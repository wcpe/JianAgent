import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MinecraftOpsSummaryDto, PlayerOnlineDto, PluginStatusDto, WorldSummaryDto } from '@jian-agent/shared-domain';
import { serverApi } from '../../api/server.api.js';
import { metricsApi } from '../../api/metrics.api.js';
import { MinecraftQuickActions } from './MinecraftQuickActions.js';

interface MinecraftOpsTabProps {
  resourceId: string;
}

function TpsBadge({ tps }: { tps: number | null }) {
  if (tps == null) return <span className="text-gray-400">-</span>;

  const color = tps >= 19 ? 'text-green-600 dark:text-green-400' :
                tps >= 15 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400';

  return (
    <span className={`text-lg font-bold ${color}`}>
      {tps.toFixed(1)}
    </span>
  );
}

function PlayerCard({ player }: { player: PlayerOnlineDto }) {
  return (
    <div className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-700/50">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs">
          {player.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{player.name}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {player.world} | {player.gamemode}
          </div>
        </div>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        ❤️ {player.health.toFixed(0)}
      </div>
    </div>
  );
}

function PluginStatusBadge({ state }: { state: string }) {
  const config: Record<string, { label: string; className: string }> = {
    enabled: { label: '启用', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    disabled: { label: '禁用', className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
    loaded: { label: '已加载', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    error: { label: '错误', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  };
  const { label, className } = config[state] ?? config.disabled;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function WorldCard({ world }: { world: WorldSummaryDto }) {
  const envLabels: Record<string, string> = {
    normal: '主世界',
    nether: '下界',
    the_end: '末地',
  };

  return (
    <div className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{world.name}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {envLabels[world.environment] ?? world.environment}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 text-xs text-gray-500 dark:text-gray-400">
        <div>玩家: {world.playerCount}</div>
        <div>实体: {world.entityCount}</div>
        <div>区块: {world.loadedChunks}</div>
      </div>
    </div>
  );
}

export function MinecraftOpsTab({ resourceId }: MinecraftOpsTabProps) {
  const [summary, setSummary] = useState<MinecraftOpsSummaryDto | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const navigate = useNavigate();

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch server info and latest metrics in parallel
      const [server, latestMetrics] = await Promise.all([
        serverApi.getServer(resourceId),
        metricsApi.getLatest(resourceId).catch(() => null),
      ]);

      // Construct a summary from available data
      const mockSummary: MinecraftOpsSummaryDto = {
        serverId: resourceId,
        generatedAt: new Date().toISOString(),
        serverRunning: server.runtimeStatus === 'running',
        tps: latestMetrics?.tps ?? null,
        players: [], // Would be populated from a dedicated players API
        maxPlayers: server.maxPlayers ?? 0,
        plugins: [], // Would be populated from plugins API
        worlds: [], // Would be populated from worlds API
        probeStatus: null,
        quickActions: [],
        serverVersion: server.version ?? null,
      };
      setSummary(mockSummary);
    } catch (err: any) {
      setError(err.message ?? '加载 Minecraft 运维信息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [resourceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mr-2"></div>
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-500 mb-2">{error}</p>
        <button onClick={loadSummary} className="text-sm text-gray-500 dark:text-gray-400">
          重试
        </button>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        暂无 Minecraft 运维数据
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Minecraft 运维</h3>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/resources/${resourceId}/terminal`)}
            className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700"
          >
            跳转到终端
          </button>
          <button
            onClick={() => navigate(`/resources/${resourceId}/plugins`)}
            className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700"
          >
            跳转到插件管理
          </button>
          <button
            onClick={loadSummary}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            刷新
          </button>
        </div>
      </div>

      {/* Server status cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">TPS</div>
          <TpsBadge tps={summary.tps} />
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">在线玩家</div>
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {summary.players.length} / {summary.maxPlayers}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">版本</div>
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {summary.serverVersion ?? '-'}
          </div>
        </div>
      </div>

      {/* Players section */}
      {summary.players.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            在线玩家 ({summary.players.length})
          </h4>
          <div className="space-y-1">
            {summary.players.map((player) => (
              <PlayerCard key={player.uuid} player={player} />
            ))}
          </div>
        </div>
      )}

      {/* Worlds section */}
      {summary.worlds.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            世界 ({summary.worlds.length})
          </h4>
          <div className="space-y-1">
            {summary.worlds.map((world) => (
              <WorldCard key={world.name} world={world} />
            ))}
          </div>
        </div>
      )}

      {/* Plugins section */}
      {summary.plugins.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            插件 ({summary.plugins.length})
          </h4>
          <div className="space-y-1">
            {summary.plugins.map((plugin) => (
              <div key={plugin.name} className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-700/50">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{plugin.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">v{plugin.version}</div>
                </div>
                <PluginStatusBadge state={plugin.state} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <MinecraftQuickActions resourceId={resourceId} serverRunning={summary.serverRunning} />
    </div>
  );
}