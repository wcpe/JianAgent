import type { PluginDetailDto } from '@jian-agent/shared-domain';
import { Package, ChevronDown, ChevronRight } from 'lucide-react';

interface PluginDetailsSectionProps {
  readonly pluginDetails: readonly PluginDetailDto[];
  readonly expanded: boolean;
  readonly onToggle: () => void;
}

export function PluginDetailsSection({ pluginDetails, expanded, onToggle }: PluginDetailsSectionProps) {
  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <Package size={18} className="text-orange-500" />
        插件列表 ({pluginDetails.length})
      </button>
      {expanded && (
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
                      {pl.authors.join(', ') || '---'}
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
  );
}
