import { type FC, useState, useEffect, useCallback } from 'react';
import { serverApi } from '../../api/server.api.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import { useRealtimeStore } from '../../stores/realtime.store.js';
import type { ServerWithStatusDto } from '@jian-agent/shared-domain';

const ServerSwitcher: FC = () => {
  const [servers, setServers] = useState<ServerWithStatusDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    serverApi.listServers().then((list) => {
      setServers([...list]);
      const active = list.find((s) => s.runtimeStatus === 'running');
      if (active) {
        setActiveId(active.id);
        useRealtimeStore.getState().setActiveServer(active.id);
      }
    });
  }, []);

  const handleSwitch = useCallback(async (id: string) => {
    setLoading(true);
    try {
      setActiveId(id);
      setOpen(false);
      useRealtimeStore.getState().setActiveServer(id);
      const list = await serverApi.listServers();
      setServers([...list]);
    } catch (err: any) {
      useDialogStore.getState().showToast(`切换失败: ${(err as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const activeServer = servers.find((s) => s.id === activeId);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'running': return '🟢';
      case 'starting': return '🟡';
      case 'stopped': return '🔴';
      case 'error': return '🔴';
      default: return '⚪';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-left transition-colors"
        disabled={loading}
      >
        <span className="text-sm">
          {activeServer ? statusIcon(activeServer.runtimeStatus) : '⚪'}
        </span>
        <span className="flex-1 text-sm text-zinc-200 truncate">
          {activeServer?.name ?? '选择服务器'}
        </span>
        <svg
          className={`w-4 h-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {servers.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSwitch(s.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-700 transition-colors ${
                s.id === activeId ? 'bg-zinc-700/50' : ''
              }`}
              disabled={loading}
            >
              <span className="text-sm">{statusIcon(s.runtimeStatus)}</span>
              <span className="flex-1 text-sm text-zinc-200">{s.name}</span>
              {s.id === activeId && (
                <span className="text-[10px] text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">
                  当前
                </span>
              )}
            </button>
          ))}
          {servers.length === 0 && (
            <div className="px-3 py-2 text-sm text-zinc-500">暂无服务器配置</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ServerSwitcher;
