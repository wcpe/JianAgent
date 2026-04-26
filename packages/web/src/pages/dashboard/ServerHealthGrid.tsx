import { useEffect, useState } from 'react';
import type { ServerWithStatusDto } from '@jian-agent/shared-domain';
import { metricsApi } from '../../api/metrics.api.js';

interface ServerHealthData {
  readonly tps: number | null;
  readonly memoryMb: number | null;
  readonly maxMemoryMb: number | null;
  readonly onlinePlayers: number | null;
  readonly health: string;
}

interface Props {
  readonly servers: readonly ServerWithStatusDto[];
}

export function ServerHealthGrid({ servers }: Props) {
  const [healthData, setHealthData] = useState<Record<string, ServerHealthData>>({});

  useEffect(() => {
    const running = servers.filter((s) => s.runtimeStatus === 'running');
    if (running.length === 0) return;

    const load = async () => {
      const [metricsResults, overviewResults] = await Promise.all([
        Promise.allSettled(running.map((sv) => metricsApi.getLatest(sv.id))),
        Promise.allSettled(running.map((sv) => metricsApi.getOverview(sv.id))),
      ]);

      const map: Record<string, ServerHealthData> = {};
      running.forEach((sv, i) => {
        const metrics = metricsResults[i].status === 'fulfilled' ? metricsResults[i].value : null;
        const overview = overviewResults[i].status === 'fulfilled' ? overviewResults[i].value : null;
        map[sv.id] = {
          tps: metrics?.tps ?? null,
          memoryMb: metrics?.memoryUsageMb ?? null,
          maxMemoryMb: metrics?.maxMemoryMb ?? null,
          onlinePlayers: metrics?.onlinePlayers ?? null,
          health: (overview as any)?.state ?? 'unknown',
        };
      });
      setHealthData(map);
    };
    load();
  }, [servers]);

  const running = servers.filter((s) => s.runtimeStatus === 'running');
  if (running.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">服务器健康总览</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {running.map((sv) => {
          const d = healthData[sv.id];
          const healthColor = d?.health === 'healthy' ? 'border-green-400 dark:border-green-600'
            : d?.health === 'degraded' ? 'border-yellow-400 dark:border-yellow-600'
            : d?.health === 'critical' ? 'border-red-400 dark:border-red-600'
            : 'border-gray-300 dark:border-gray-700';

          const memPct = d?.memoryMb != null && d?.maxMemoryMb ? Math.round((d.memoryMb / d.maxMemoryMb) * 100) : null;

          return (
            <div
              key={sv.id}
              className={`bg-white/80 dark:bg-gray-900/60 rounded-xl border-l-4 ${healthColor} shadow p-3 text-xs`}
            >
              <p className="font-medium text-gray-900 dark:text-gray-100 truncate mb-1.5">{sv.name}</p>
              <div className="space-y-0.5 text-gray-600 dark:text-gray-400">
                {d?.tps != null && (
                  <p>TPS: <span className={d.tps < 15 ? 'text-red-600 dark:text-red-400 font-semibold' : d.tps < 18 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}>{d.tps.toFixed(1)}</span></p>
                )}
                {memPct != null && (
                  <p>内存: <span className={memPct > 85 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-700 dark:text-gray-300'}>{memPct}%</span></p>
                )}
                {d?.onlinePlayers != null && <p>玩家: {d.onlinePlayers}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
