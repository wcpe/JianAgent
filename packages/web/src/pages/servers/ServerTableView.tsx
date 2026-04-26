import type { ServerWithStatusDto } from '@jian-agent/shared-domain';
import { ServerStatusPill } from '../../components/ServerStatusPill.js';
import { useServerStore } from '../../stores/server.store.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import { formatServerAddress } from '../../constants/server-defaults.js';

interface ServerTableViewProps {
  readonly servers: readonly ServerWithStatusDto[];
  readonly onEdit: (server: ServerWithStatusDto) => void;
  readonly onTerminal: (serverId: string) => void;
  readonly selectedIds?: ReadonlySet<string>;
  readonly onToggleSelect?: (serverId: string) => void;
}

function formatUptime(ms?: number): string {
  if (!ms) return '—';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return h > 0 ? `${h}h${m}m` : `${m}m`;
}

export function ServerTableView({ servers, onEdit, onTerminal, selectedIds, onToggleSelect }: ServerTableViewProps) {
  const { startServer, stopServer, restartServer, deleteServer } = useServerStore();

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/55 dark:border-primary-300/20 backdrop-blur-xl bg-white/80 dark:bg-gray-900/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/40 dark:border-primary-300/10 bg-white/40 dark:bg-gray-800/40 text-left text-xs text-gray-600 dark:text-gray-300 uppercase whitespace-nowrap font-semibold">
            {onToggleSelect && <th className="px-4 py-3 w-8"></th>}
            <th className="px-4 py-3">名称</th>
            <th className="px-4 py-3">状态</th>
            <th className="px-4 py-3">Jar</th>
            <th className="px-4 py-3">host:port</th>
            <th className="px-4 py-3">PID</th>
            <th className="px-4 py-3">运行时长</th>
            <th className="px-4 py-3">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/30 dark:divide-primary-300/10">
          {servers.map((s) => {
            const status = (s.runtimeStatus ?? 'unknown') as any;
            const isRunning = status === 'running';
            const isBusy = status === 'starting' || status === 'stopping';
            const isExternal = s.serverType === 'external';
            const isSelected = selectedIds?.has(s.id) ?? false;
            return (
              <tr key={s.id} className={`transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : s.id.charCodeAt(0) % 2 === 0
                  ? 'hover:bg-white/50 dark:hover:bg-gray-800/50'
                  : 'bg-white/20 dark:bg-gray-800/10 hover:bg-white/60 dark:hover:bg-gray-800/60'
              }`}>
                {onToggleSelect && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(s.id) ?? false}
                      onChange={() => onToggleSelect(s.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                )}
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{s.name}</td>
                <td className="px-4 py-3">
                  <ServerStatusPill status={status} />
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{s.jarPath ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatServerAddress(s.host, s.port)}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{s.pid ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatUptime(s.uptime)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {!isExternal && !isRunning && !isBusy && (
                      <button title="正常启动服务器进程" onClick={() => startServer(s.id)} className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline text-xs active:scale-90 transition-all duration-100">启动</button>
                    )}
                    {!isExternal && isRunning && (
                      <>
                        <button title="向服务器发送 stop 指令安全停机" onClick={() => stopServer(s.id)} className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline text-xs active:scale-90 transition-all duration-100">停止</button>
                        <button title="先安全停机再重新启动" onClick={() => restartServer(s.id)} className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline text-xs active:scale-90 transition-all duration-100">重启</button>
                      </>
                    )}
                    {!isExternal && (
                      <button onClick={() => onTerminal(s.id)} className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline text-xs active:scale-90 transition-all duration-100">终端</button>
                    )}
                    <button onClick={() => onEdit(s)} className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline text-xs active:scale-90 transition-all duration-100">编辑</button>
                    <button
                      onClick={async () => { const ok = await useDialogStore.getState().confirm({ title: '删除服务器', message: `确定删除 "${s.name}"？`, variant: 'danger', confirmLabel: '删除' }); if (ok) deleteServer(s.id); }}
                      disabled={!isExternal && (isRunning || isBusy)}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:underline text-xs disabled:opacity-40 active:scale-90 transition-all duration-100"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
