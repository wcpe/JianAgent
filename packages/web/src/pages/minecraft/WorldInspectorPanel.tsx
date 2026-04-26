import { useState } from 'react';
import type { ProbeSnapshotDto, WorldMetricDto } from '@jian-agent/shared-domain';

interface WorldInspectorPanelProps {
  serverId: string;
  snapshot: ProbeSnapshotDto | null;
  connected: boolean;
}

export function WorldInspectorPanel({ serverId: _serverId, snapshot, connected }: WorldInspectorPanelProps) {
  const [selectedWorld, setSelectedWorld] = useState<string | null>(null);

  const worlds = snapshot?.worlds ?? [];
  const selected = selectedWorld
    ? worlds.find((w) => w.name === selectedWorld) ?? null
    : null;

  const environmentLabel = (env: string) => {
    const labels: Record<string, { label: string; color: string }> = {
      normal: { label: '主世界', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
      nether: { label: '下界', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
      the_end: { label: '末地', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' },
    };
    return labels[env] ?? { label: env, color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
  };

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800/50">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">
          世界详情
          {worlds.length > 0 && (
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
              ({worlds.length} 个世界)
            </span>
          )}
        </h2>
      </div>

      {!connected && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
          探针未连接，无法获取世界数据
        </p>
      )}

      {connected && worlds.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
          未检测到世界数据
        </p>
      )}

      {connected && worlds.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* World List */}
          <div className="lg:col-span-1 space-y-2">
            {worlds.map((world) => {
              const env = environmentLabel(world.environment);
              const isActive = selectedWorld === world.name;
              return (
                <button
                  key={world.name}
                  onClick={() => setSelectedWorld(isActive ? null : world.name)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    isActive
                      ? 'border-primary-300 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      {isActive ? '▼' : '▶'} {world.name}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${env.color}`}>
                      {env.label}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>区块: {world.loadedChunks.toLocaleString()}</span>
                    <span>实体: {world.entityCount.toLocaleString()}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* World Detail */}
          <div className="lg:col-span-2">
            {selected ? (
              <WorldDetail world={selected} environmentLabel={environmentLabel} />
            ) : (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center text-sm text-gray-400 dark:text-gray-500 h-full flex items-center justify-center">
                选择一个世界查看详情
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function WorldDetail({
  world,
  environmentLabel,
}: {
  world: WorldMetricDto;
  environmentLabel: (env: string) => { label: string; color: string };
}) {
  const env = environmentLabel(world.environment);
  const entityEntries = Object.entries(world.entityTypes ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{world.name}</h3>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${env.color}`}>
            {env.label}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-gray-50 dark:bg-gray-900/30 p-3">
          <span className="text-xs text-gray-400 dark:text-gray-500 block">已加载区块</span>
          <span className="text-lg font-mono font-semibold text-gray-900 dark:text-gray-100">
            {world.loadedChunks.toLocaleString()}
          </span>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-900/30 p-3">
          <span className="text-xs text-gray-400 dark:text-gray-500 block">实体总数</span>
          <span className="text-lg font-mono font-semibold text-gray-900 dark:text-gray-100">
            {world.entityCount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Entity Types Breakdown */}
      {entityEntries.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">实体类型分布</h4>
          <div className="overflow-auto max-h-48 border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900/40 sticky top-0">
                <tr>
                  <th className="p-2 text-left text-gray-700 dark:text-gray-300 font-medium">类型</th>
                  <th className="p-2 text-right text-gray-700 dark:text-gray-300 font-medium">数量</th>
                  <th className="p-2 text-left text-gray-700 dark:text-gray-300 font-medium w-32">占比</th>
                </tr>
              </thead>
              <tbody>
                {entityEntries.map(([type, count]) => {
                  const pct = world.entityCount > 0 ? (count / world.entityCount) * 100 : 0;
                  return (
                    <tr key={type} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="p-2 font-mono text-gray-700 dark:text-gray-300">{type}</td>
                      <td className="p-2 text-right font-mono text-gray-700 dark:text-gray-300">{count}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500 dark:bg-primary-400 rounded-full"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className="text-gray-500 dark:text-gray-400 text-[10px] font-mono w-10 text-right">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
