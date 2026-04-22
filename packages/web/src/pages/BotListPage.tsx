import { useEffect } from 'react';
import { useBotStore } from '../stores/bot.store.js';
import { BotStateTag } from '../components/BotStateTag.js';
import { BotDetailPanel } from './BotDetailPanel.js';

export function BotListPage() {
  const { bots, selectedBotName, loading, fetchBots, selectBot, stopAll } = useBotStore();

  useEffect(() => { fetchBots(); }, [fetchBots]);

  return (
    <div className="flex gap-4 p-4 h-full">
      <div className="flex-1 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Bot 管理</h1>
          <button
            className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm transition-colors"
            onClick={() => { stopAll(); }}
          >
            全部停止
          </button>
        </div>
        {loading && <p className="text-gray-500 dark:text-gray-400">加载中…</p>}
        <div className="overflow-x-auto rounded-2xl border border-white/55 dark:border-primary-300/20 backdrop-blur-xl bg-white/80 dark:bg-slate-900/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/40 dark:border-primary-300/10 bg-white/40 dark:bg-slate-800/40 text-left text-xs text-gray-600 dark:text-gray-300 uppercase font-semibold">
              <th className="px-4 py-2">名称</th>
              <th className="px-4 py-2">状态</th>
              <th className="px-4 py-2">行为</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/30 dark:divide-primary-300/10">
            {bots.map((bot) => (
              <tr
                key={bot.name}
                className={`cursor-pointer transition-colors ${
                  selectedBotName === bot.name 
                    ? 'bg-primary-500/20 dark:bg-primary-900/30' 
                    : bots.indexOf(bot) % 2 === 0
                    ? 'hover:bg-white/50 dark:hover:bg-slate-800/50'
                    : 'bg-white/20 dark:bg-slate-800/10 hover:bg-white/60 dark:hover:bg-slate-800/60'
                }`}
                onClick={() => selectBot(bot.name)}
              >
                <td className="px-4 py-2 font-mono text-gray-900 dark:text-gray-100">{bot.name}</td>
                <td className="px-4 py-2"><BotStateTag state={bot.state} /></td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{bot.currentBehavior ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {selectedBotName && (
        <div className="w-96 border-l border-gray-200 dark:border-gray-700 pl-4">
          <BotDetailPanel name={selectedBotName} onClose={() => selectBot(null)} />
        </div>
      )}
    </div>
  );
}
