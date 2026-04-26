import { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ErrorAlert } from '../../components/ui/ErrorAlert.js';
import { probeApi } from '../../api/probe.api.js';
import { useWsChannel } from '../../ws/use-ws-channel.js';
import type { ProbeSnapshotDto } from '@jian-agent/shared-domain';
import { PlayerListPanel } from './PlayerListPanel.js';
import { PluginSnapshotPanel } from './PluginSnapshotPanel.js';
import { WorldInspectorPanel } from './WorldInspectorPanel.js';
import { ProbeConsolePanel } from './ProbeConsolePanel.js';

export function MinecraftDrillDownPage() {
  const { id: serverId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [snapshot, setSnapshot] = useState<ProbeSnapshotDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'players' | 'plugins' | 'worlds' | 'console'>('players');

  const connected = !!snapshot;

  const fetchSnapshot = useCallback(async () => {
    if (!serverId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await probeApi.getSnapshot(serverId);
      setSnapshot(res.snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  const handleWsSnapshot = useCallback(
    (payload: { serverId: string; snapshot: ProbeSnapshotDto }) => {
      if (payload.serverId === serverId) {
        setSnapshot(payload.snapshot);
      }
    },
    [serverId],
  );
  useWsChannel('probe:snapshot', handleWsSnapshot);

  if (!serverId) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        缺少 serverId 参数
      </div>
    );
  }

  const tabs = [
    { key: 'players' as const, label: '在线玩家' },
    { key: 'plugins' as const, label: '插件快照' },
    { key: 'worlds' as const, label: '世界详情' },
    { key: 'console' as const, label: '探针控制台' },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/servers/${serverId}/minecraft`)}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ← 返回
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Minecraft 深度钻取</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Server: <span className="font-mono">{serverId}</span>
          </p>
        </div>
        <button
          onClick={fetchSnapshot}
          disabled={loading}
          className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {loading ? '刷新中…' : '刷新快照'}
        </button>
      </div>

      {/* Error */}
      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Status Bar */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800/50">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <span className="text-xs text-gray-400 dark:text-gray-500 block">探针状态</span>
            <span className={`text-sm font-semibold ${connected ? 'text-success-600 dark:text-success-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {connected ? '已连接' : loading ? '加载中…' : '未连接'}
            </span>
          </div>
          {snapshot && (
            <>
              <div>
                <span className="text-xs text-gray-400 dark:text-gray-500 block">TPS</span>
                <span className={`text-sm font-mono font-semibold ${
                  snapshot.tps >= 19 ? 'text-success-600 dark:text-success-400' :
                  snapshot.tps >= 15 ? 'text-warning-600 dark:text-warning-400' :
                  'text-danger-600 dark:text-danger-400'
                }`}>
                  {snapshot.tps.toFixed(1)}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-400 dark:text-gray-500 block">MSPT</span>
                <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                  {snapshot.mspt.toFixed(1)} ms
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-400 dark:text-gray-500 block">在线玩家</span>
                <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                  {snapshot.onlinePlayers}/{snapshot.maxPlayers}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-400 dark:text-gray-500 block">区块</span>
                <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                  {snapshot.loadedChunks.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-400 dark:text-gray-500 block">实体</span>
                <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                  {snapshot.entityCount.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-400 dark:text-gray-500 block">内存</span>
                <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                  {snapshot.freeMemoryMb.toFixed(0)}/{snapshot.totalMemoryMb.toFixed(0)} MB
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-400 dark:text-gray-500 block">运行时间</span>
                <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                  {snapshot.uptime}
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.key
                ? 'bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 border-b-white dark:border-b-gray-800/50 text-primary-600 dark:text-primary-400 -mb-px'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'players' && (
          <PlayerListPanel serverId={serverId} snapshot={snapshot} connected={connected} />
        )}
        {activeTab === 'plugins' && (
          <PluginSnapshotPanel serverId={serverId} snapshot={snapshot} connected={connected} />
        )}
        {activeTab === 'worlds' && (
          <WorldInspectorPanel serverId={serverId} snapshot={snapshot} connected={connected} />
        )}
        {activeTab === 'console' && (
          <ProbeConsolePanel serverId={serverId} connected={connected} />
        )}
      </div>
    </div>
  );
}
