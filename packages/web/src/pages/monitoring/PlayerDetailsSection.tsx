import type { PlayerDetailDto } from '@jian-agent/shared-domain';
import { Users, ChevronDown, ChevronRight, Heart } from 'lucide-react';

interface PlayerDetailsSectionProps {
  readonly playerDetails: readonly PlayerDetailDto[];
  readonly expanded: boolean;
  readonly onToggle: () => void;
}

export function PlayerDetailsSection({ playerDetails, expanded, onToggle }: PlayerDetailsSectionProps) {
  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <Users size={18} className="text-blue-500" />
        在线玩家详情 ({playerDetails.length})
      </button>
      {expanded && (
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
                        {(p.health ?? 0).toFixed(1)}/{(p.maxHealth ?? 0).toFixed(0)}
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
                        {p.ping >= 0 ? `${p.ping}ms` : '---'}
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
  );
}
