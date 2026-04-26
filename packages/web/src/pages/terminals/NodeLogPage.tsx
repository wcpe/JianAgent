import { NodeLogTerm } from './NodeLogTerm.js';

export function NodeLogPage() {
  return (
    <div className="h-full flex flex-col gap-3 p-3">
      <div className="rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/75 dark:bg-gray-900/60 backdrop-blur-xl shadow-xl px-4 py-3">
        <div className="text-xs tracking-[0.28em] uppercase text-gray-400 mb-1">NODE RUNTIME</div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Node Log</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          平台运行日志不属于某一台 Minecraft 服务器，已从服务器终端中独立出来。
        </p>
      </div>
      <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-white/55 dark:border-primary-300/20 bg-[var(--terminal-bg)] shadow-xl">
        <NodeLogTerm />
      </div>
    </div>
  );
}
