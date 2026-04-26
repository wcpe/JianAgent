import {
  Heart,
  Wifi,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { botApi, type BotSnapshot } from '../../api/bot.api.js';

interface BotConsoleStatusPanelProps {
  readonly bot: BotSnapshot | null;
  readonly decodedName: string;
  readonly setBot: React.Dispatch<React.SetStateAction<BotSnapshot | null>>;
}

export function BotConsoleStatusPanel({ bot, decodedName, setBot }: BotConsoleStatusPanelProps) {
  return (
    <div className="p-3 border-b border-gray-200 dark:border-gray-700">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">实时状态</h3>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white dark:bg-gray-900 rounded p-2">
          <div className="flex items-center gap-1 text-[10px] text-gray-400"><Heart className="w-3 h-3 text-danger-400" />生命</div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{bot?.health?.toFixed(1) ?? '—'}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded p-2">
          <div className="flex items-center gap-1 text-[10px] text-gray-400">🍖 饱食度</div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{bot?.food ?? '—'}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded p-2">
          <div className="flex items-center gap-1 text-[10px] text-gray-400"><Wifi className="w-3 h-3 text-info-400" />延迟</div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{bot?.latencyMs ? `${bot.latencyMs}ms` : '—'}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded p-2">
          <div className="flex items-center gap-1 text-[10px] text-gray-400"><MapPin className="w-3 h-3 text-success-400" />世界</div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate" title={bot?.world}>{bot?.world || '—'}</p>
        </div>
        <div className="col-span-2 bg-white dark:bg-gray-900 rounded p-2">
          <div className="flex items-center gap-1 text-[10px] text-gray-400"><MapPin className="w-3 h-3 text-warning-400" />坐标</div>
          <p className="text-sm font-mono text-gray-800 dark:text-gray-200">
            {bot?.x !== undefined ? `${bot.x.toFixed(1)}, ${bot.y.toFixed(1)}, ${bot.z.toFixed(1)}` : '—'}
          </p>
        </div>
        {bot?.connectedAt && (
          <div className="col-span-2 bg-white dark:bg-gray-900 rounded p-2">
            <div className="text-[10px] text-gray-400">连接时间</div>
            <p className="text-xs text-gray-600 dark:text-gray-300">{new Date(bot.connectedAt).toLocaleString()}</p>
          </div>
        )}
        {bot?.lastError && (
          <div className="col-span-2 bg-danger-50 dark:bg-danger-700/30 rounded p-2">
            <div className="text-[10px] text-danger-400">最近错误</div>
            <p className="text-xs text-danger-600 dark:text-danger-200 truncate" title={bot.lastError}>{bot.lastError}</p>
          </div>
        )}
      </div>
      <button
        onClick={() => {
          botApi.getOne(decodedName).then((res) => setBot(res.data)).catch(() => {});
        }}
        className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 py-1"
      >
        <RefreshCw className="w-3 h-3" /> 刷新状态
      </button>
    </div>
  );
}
