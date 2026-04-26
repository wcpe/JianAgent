import { useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useThemeStore } from '../../stores/theme.store.js';
import { useTranslation } from 'react-i18next';
import { DEFAULT_NAV_ORDER, getOrderedNavGroups, getOrderedItems } from '../../components/layout/nav-config.js';

const JIANAGENT_PREFIX = 'jianagent-';

function getCacheEntries(): { key: string; size: number }[] {
  const entries: { key: string; size: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(JIANAGENT_PREFIX)) {
      const val = localStorage.getItem(key) ?? '';
      entries.push({ key, size: new Blob([val]).size });
    }
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

export function SettingsPage() {
  const { t } = useTranslation();
  const navGroupOrder = useThemeStore((s) => s.navGroupOrder);
  const navItemOrder = useThemeStore((s) => s.navItemOrder);
  const resetNavGroupOrder = useThemeStore((s) => s.resetNavGroupOrder);
  const clearAllCache = useThemeStore((s) => s.clearAllCache);

  const [cacheEntries, setCacheEntries] = useState(getCacheEntries);
  const [confirmClear, setConfirmClear] = useState(false);

  const orderedGroups = getOrderedNavGroups(navGroupOrder);
  const isDefaultOrder = JSON.stringify([...navGroupOrder]) === JSON.stringify([...DEFAULT_NAV_ORDER]);

  const totalSize = cacheEntries.reduce((sum, e) => sum + e.size, 0);

  const handleClearCache = () => {
    clearAllCache();
    setCacheEntries(getCacheEntries());
    setConfirmClear(false);
    window.location.reload();
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">{t('nav.settings')}</h1>

      {/* Navigation Order */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">导航排序</h2>
        <div className="bg-white/80 dark:bg-gray-900/60 rounded-2xl border border-white/55 dark:border-primary-300/20 shadow-xl backdrop-blur-xl p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            在侧边栏中拖拽分组标题可以调整顺序，排序会自动保存到浏览器中。
          </p>
          <div className="space-y-1.5 mb-4">
            {orderedGroups.map((group, idx) => (
              <div key={group.id}>
                <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-sm">
                  <span className="w-5 text-center text-gray-400 text-xs font-mono">{idx + 1}</span>
                  <group.icon size={16} className="text-gray-500 dark:text-gray-400 shrink-0" />
                  <span className="text-gray-900 dark:text-gray-100 font-medium">{t(`sidebar.${group.id}`)}</span>
                </div>
                <div className="ml-10 mt-0.5 space-y-0.5">
                  {getOrderedItems(group, navItemOrder).map((item) => (
                    <div key={item.path} className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                      <item.icon size={12} className="shrink-0" />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={isDefaultOrder}
            onClick={resetNavGroupOrder}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw size={14} />
            重置为默认顺序
          </button>
        </div>
      </section>

      {/* Cache Management */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">缓存管理</h2>
        <div className="bg-white/80 dark:bg-gray-900/60 rounded-2xl border border-white/55 dark:border-primary-300/20 shadow-xl backdrop-blur-xl p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            以下数据存储在浏览器的 localStorage 中。清除后将重置主题、导航排序等偏好设置。
          </p>

          {cacheEntries.length > 0 ? (
            <div className="mb-4 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <th className="px-3 py-2 text-left">键名</th>
                    <th className="px-3 py-2 text-right">大小</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {cacheEntries.map((entry) => (
                    <tr key={entry.key} className="text-gray-700 dark:text-gray-300">
                      <td className="px-3 py-1.5 font-mono text-xs">{entry.key}</td>
                      <td className="px-3 py-1.5 text-right text-xs text-gray-500">{entry.size} B</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    <td className="px-3 py-2">共 {cacheEntries.length} 项</td>
                    <td className="px-3 py-2 text-right">{totalSize} B</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-4">暂无缓存数据</p>
          )}

          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 size={14} />
              清除所有缓存
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-red-600 dark:text-red-400">确认清除？页面将刷新。</span>
              <button
                type="button"
                onClick={handleClearCache}
                className="px-3 py-1.5 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                确认
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                取消
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
