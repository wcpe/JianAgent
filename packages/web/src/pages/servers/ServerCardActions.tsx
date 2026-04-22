import { useNavigate } from 'react-router-dom';
import { useServerStore } from '../../stores/server.store.js';
import { useServerContext } from '../../stores/server-context.store.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import type { ServerWithStatusDto } from '@jian-agent/shared-domain';
import { Play, Square, Zap, RotateCw, Terminal, Settings, Trash2, Bot, Beaker } from 'lucide-react';

interface ServerCardActionsProps {
  readonly server: ServerWithStatusDto;
  readonly onEdit: () => void;
  readonly onTerminal: () => void;
}

export function ServerCardActions({ server, onEdit, onTerminal }: ServerCardActionsProps) {
  const { startServer, stopServer, interruptServer, restartServer, deleteServer } = useServerStore();
  const showToast = useDialogStore((s) => s.showToast);
  const setActiveServer = useServerContext((s) => s.setActiveServer);
  const navigate = useNavigate();
  const status = server.runtimeStatus;
  const isRunning = status === 'running';
  const isBusy = status === 'starting' || status === 'stopping';
  const isStopped = status === 'stopped' || status === 'error';
  const isExternal = server.serverType === 'external';

  const lifecycle = async (action: () => Promise<void>, label: string) => {
    try {
      await action();
      showToast(`${server.name} ${label}`, 'success');
    } catch (err: any) {
      showToast(err.message ?? `${label}失败`, 'error');
    }
  };

  return (
    <div className="space-y-2">
      {/* Lifecycle — hide for external servers */}
      {!isExternal && (
      <div className="flex gap-1.5 flex-wrap items-center">
        <button
          onClick={() => lifecycle(() => startServer(server.id), '启动中')}
          disabled={isRunning || isBusy}
          title="正常启动服务器进程"
          className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded disabled:opacity-40 hover:bg-green-700 active:scale-95 transition-all duration-150"
        >
          <Play className="w-3.5 h-3.5" /> 启动
        </button>
        <button
          onClick={() => lifecycle(() => stopServer(server.id), '已下发停止指令')}
          disabled={!isRunning}
          title="向服务器发送 stop 指令安全停机"
          className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded disabled:opacity-40 hover:bg-red-700 active:scale-95 transition-all duration-150"
        >
          <Square className="w-3.5 h-3.5" /> 停止
        </button>
        <button
          onClick={() => lifecycle(() => interruptServer(server.id), '已强制中断')}
          disabled={!isRunning}
          title="直接杀掉进程 (SIGKILL)，可能导致数据丢失"
          className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-600 text-white rounded disabled:opacity-40 hover:bg-orange-700 active:scale-95 transition-all duration-150"
        >
          <Zap className="w-3.5 h-3.5" /> 中断
        </button>
        <button
          onClick={() => lifecycle(() => restartServer(server.id), '正在重启')}
          disabled={!isRunning}
          title="先安全停机再重新启动"
          className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-600 text-white rounded disabled:opacity-40 hover:bg-yellow-700 active:scale-95 transition-all duration-150"
        >
          <RotateCw className="w-3.5 h-3.5" /> 重启
        </button>
      </div>
      )}

      {/* Tools */}
      <div className="flex gap-1.5 flex-wrap">
        {!isExternal && (
        <button
          onClick={onTerminal}
          className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 active:scale-95 transition-all duration-150 text-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          <Terminal className="w-3.5 h-3.5" /> 终端
        </button>
        )}
        <button
          onClick={onEdit}
          className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 active:scale-95 transition-all duration-150 text-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          <Settings className="w-3.5 h-3.5" /> 编辑
        </button>
        <button
          onClick={async () => {
            const confirmed = await useDialogStore.getState().confirm({ title: '删除服务器', message: `确定删除服务器 "${server.name}" ？`, variant: 'danger', confirmLabel: '删除' });
            if (confirmed) {
              try {
                await deleteServer(server.id);
                showToast(`${server.name} 已删除`, 'success');
              } catch (err: any) {
                showToast(err.message ?? '删除失败', 'error');
              }
            }
          }}
          disabled={!isExternal && (isRunning || isBusy)}
          title={!isExternal && (isRunning || isBusy) ? '请先停止服务器' : undefined}
          className="flex items-center gap-1 px-2 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-40 active:scale-95 transition-all duration-150 dark:border-red-800 dark:text-red-500 dark:hover:bg-red-900/30"
        >
          <Trash2 className="w-3.5 h-3.5" /> 删除
        </button>
        <button
          onClick={() => { setActiveServer(server.id); navigate(`/bots?serverId=${server.id}`); }}
          className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 active:scale-95 transition-all duration-150 text-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          <Bot className="w-3.5 h-3.5" /> 机器人
        </button>
        <button
          onClick={() => navigate(`/quick-tests?serverId=${server.id}`)}
          className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 active:scale-95 transition-all duration-150 text-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          <Beaker className="w-3.5 h-3.5" /> 测试
        </button>
      </div>
    </div>
  );
}
