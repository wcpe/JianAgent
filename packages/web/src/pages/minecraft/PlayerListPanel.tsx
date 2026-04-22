import { useState } from 'react';
import type { ProbeSnapshotDto, PlayerDetailDto } from '@jian-agent/shared-domain';

interface PlayerListPanelProps {
  serverId: string;
  snapshot: ProbeSnapshotDto | null;
  connected: boolean;
}

export function PlayerListPanel({ serverId: _serverId, snapshot, connected }: PlayerListPanelProps) {
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const players = snapshot?.players ?? [];

  const filteredPlayers = players.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const toggleExpand = (uuid: string) => {
    setExpandedPlayer((prev) => (prev === uuid ? null : uuid));
  };

  const healthColor = (health: number, maxHealth: number) => {
    const ratio = health / maxHealth;
    if (ratio > 0.6) return 'text-green-600 dark:text-green-400';
    if (ratio > 0.3) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const gamemodeBadge = (mode: string) => {
    const colors: Record<string, string> = {
      survival: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
      creative: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
      adventure: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
      spectator: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    };
    return colors[mode] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  };

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800/50">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">
          在线玩家 {players.length > 0 && <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({players.length})</span>}
        </h2>
        {players.length > 0 && (
          <input
            type="text"
            placeholder="搜索玩家..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 w-48"
          />
        )}
      </div>

      {!connected && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
          探针未连接，无法获取玩家数据
        </p>
      )}

      {connected && players.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
          当前无在线玩家
        </p>
      )}

      {connected && players.length > 0 && (
        <div className="overflow-auto max-h-[28rem] border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40 sticky top-0 z-10">
              <tr>
                <th className="p-2 text-left text-gray-700 dark:text-gray-300 font-medium">玩家</th>
                <th className="p-2 text-left text-gray-700 dark:text-gray-300 font-medium w-24">模式</th>
                <th className="p-2 text-left text-gray-700 dark:text-gray-300 font-medium w-20">生命</th>
                <th className="p-2 text-left text-gray-700 dark:text-gray-300 font-medium w-20">等级</th>
                <th className="p-2 text-left text-gray-700 dark:text-gray-300 font-medium w-28">世界</th>
                <th className="p-2 text-left text-gray-700 dark:text-gray-300 font-medium w-16">延迟</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player) => (
                <PlayerRow
                  key={player.uuid}
                  player={player}
                  expanded={expandedPlayer === player.uuid}
                  onToggle={() => toggleExpand(player.uuid)}
                  healthColor={healthColor}
                  gamemodeBadge={gamemodeBadge}
                />
              ))}
            </tbody>
          </table>
          {filteredPlayers.length === 0 && (
            <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
              无匹配玩家
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PlayerRow({
  player,
  expanded,
  onToggle,
  healthColor,
  gamemodeBadge,
}: {
  player: PlayerDetailDto;
  expanded: boolean;
  onToggle: () => void;
  healthColor: (h: number, m: number) => string;
  gamemodeBadge: (m: string) => string;
}) {
  return (
    <>
      <tr
        className="border-t border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
        onClick={onToggle}
      >
        <td className="p-2 font-medium text-gray-900 dark:text-gray-100">
          {expanded ? '▼' : '▶'} {player.name}
        </td>
        <td className="p-2">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${gamemodeBadge(player.gameMode)}`}>
            {player.gameMode}
          </span>
        </td>
        <td className={`p-2 font-mono ${healthColor(player.health, player.maxHealth)}`}>
          {player.health.toFixed(0)}/{player.maxHealth.toFixed(0)}
        </td>
        <td className="p-2 font-mono text-gray-700 dark:text-gray-300">
          Lv.{player.level}
        </td>
        <td className="p-2 text-gray-600 dark:text-gray-400 truncate max-w-[120px]">
          {player.world}
        </td>
        <td className="p-2 font-mono text-gray-600 dark:text-gray-400">
          {player.ping}ms
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-gray-200 dark:border-gray-700">
          <td colSpan={6} className="p-3 bg-gray-50 dark:bg-gray-900/30">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-gray-400 dark:text-gray-500 block">UUID</span>
                <span className="font-mono text-gray-700 dark:text-gray-300">{player.uuid}</span>
              </div>
              <div>
                <span className="text-gray-400 dark:text-gray-500 block">坐标</span>
                <span className="font-mono text-gray-700 dark:text-gray-300">
                  {player.x.toFixed(0)}, {player.y.toFixed(0)}, {player.z.toFixed(0)}
                </span>
              </div>
              <div>
                <span className="text-gray-400 dark:text-gray-500 block">饥饿值</span>
                <span className="font-mono text-gray-700 dark:text-gray-300">{player.food}</span>
              </div>
              <div>
                <span className="text-gray-400 dark:text-gray-500 block">延迟</span>
                <span className="font-mono text-gray-700 dark:text-gray-300">{player.ping} ms</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
