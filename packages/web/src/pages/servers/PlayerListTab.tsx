import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../../api/client.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import { RefreshCw, Users, Search, Terminal, UserX, Shield, ShieldOff, MapPin } from 'lucide-react';

interface PlayerListTabProps {
  readonly serverId: string;
}

interface SnapshotResponse {
  readonly serverId: string;
  readonly snapshot: {
    readonly playerNames?: readonly string[];
    readonly onlinePlayers: number;
    readonly maxPlayers: number;
  };
  readonly receivedAt: string;
}

export function PlayerListTab({ serverId }: PlayerListTabProps) {
  const [players, setPlayers] = useState<readonly string[]>([]);
  const [online, setOnline] = useState(0);
  const [max, setMax] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [cmdLoading, setCmdLoading] = useState(false);

  const fetchPlayers = useCallback(async () => {
    if (!serverId) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<SnapshotResponse>(`/plugin-bridge/snapshot/${encodeURIComponent(serverId)}`);
      setPlayers(res.snapshot.playerNames ?? []);
      setOnline(res.snapshot.onlinePlayers ?? 0);
      setMax(res.snapshot.maxPlayers ?? 0);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch {
      setError('无法获取玩家列表（服务器可能未安装探针插件）');
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);

  // Auto-refresh every 10s
  useEffect(() => {
    const timer = setInterval(fetchPlayers, 10_000);
    return () => clearInterval(timer);
  }, [fetchPlayers]);

  const sendConsoleCommand = async (command: string) => {
    setCmdLoading(true);
    try {
      await apiFetch(`/plugin-bridge/console/${encodeURIComponent(serverId)}`, {
        method: 'POST',
        body: JSON.stringify({ command }),
      });
      useDialogStore.getState().showToast(`已发送: ${command}`, 'success');
      // Refresh after a short delay to see the effect
      setTimeout(fetchPlayers, 1500);
    } catch {
      useDialogStore.getState().showToast('命令发送失败', 'error');
    } finally {
      setCmdLoading(false);
    }
  };

  const handleKick = (name: string) => {
    if (confirm(`确认踢出玩家 ${name}？`)) {
      sendConsoleCommand(`kick ${name}`);
      setSelectedPlayer(null);
    }
  };

  const handleBan = (name: string) => {
    if (confirm(`确认封禁玩家 ${name}？`)) {
      sendConsoleCommand(`ban ${name}`);
      setSelectedPlayer(null);
    }
  };

  const handleOp = (name: string) => sendConsoleCommand(`op ${name}`);
  const handleDeop = (name: string) => sendConsoleCommand(`deop ${name}`);
  const handleTp = (name: string) => {
    const target = prompt(`传送 ${name} 到哪个玩家？（输入目标玩家名）`);
    if (target?.trim()) {
      sendConsoleCommand(`tp ${name} ${target.trim()}`);
    }
  };

  const filtered = search
    ? players.filter((n) => n.toLowerCase().includes(search.toLowerCase()))
    : players;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            在线玩家 {online}/{max}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-400">最后刷新: {lastRefresh}</span>
          )}
          <button
            onClick={fetchPlayers}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 active:scale-95 transition-all duration-150"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索玩家..."
            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded text-xs"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="text-sm text-red-500 dark:text-red-400 mb-3">{error}</div>
        )}

        {!error && filtered.length === 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            {search ? '无匹配玩家' : '当前无在线玩家'}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {filtered.map((name) => (
              <div
                key={name}
                onClick={() => setSelectedPlayer(selectedPlayer === name ? null : name)}
                className={`flex flex-col gap-1 px-3 py-2 rounded border transition-all cursor-pointer ${
                  selectedPlayer === name
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 ring-1 ring-blue-200 dark:ring-blue-800'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <span className="text-sm text-gray-800 dark:text-gray-200 truncate font-medium">{name}</span>
                </div>

                {/* Player action buttons */}
                {selectedPlayer === name && (
                  <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                    <ActionBtn
                      icon={<UserX className="w-3 h-3" />}
                      label="踢出"
                      color="red"
                      disabled={cmdLoading}
                      onClick={(e) => { e.stopPropagation(); handleKick(name); }}
                    />
                    <ActionBtn
                      icon={<Shield className="w-3 h-3" />}
                      label="封禁"
                      color="red"
                      disabled={cmdLoading}
                      onClick={(e) => { e.stopPropagation(); handleBan(name); }}
                    />
                    <ActionBtn
                      icon={<ShieldOff className="w-3 h-3" />}
                      label="OP"
                      color="blue"
                      disabled={cmdLoading}
                      onClick={(e) => { e.stopPropagation(); handleOp(name); }}
                    />
                    <ActionBtn
                      icon={<Shield className="w-3 h-3" />}
                      label="DeOP"
                      color="gray"
                      disabled={cmdLoading}
                      onClick={(e) => { e.stopPropagation(); handleDeop(name); }}
                    />
                    <ActionBtn
                      icon={<MapPin className="w-3 h-3" />}
                      label="传送"
                      color="green"
                      disabled={cmdLoading}
                      onClick={(e) => { e.stopPropagation(); handleTp(name); }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick command bar */}
      <QuickCommandBar serverId={serverId} onSend={sendConsoleCommand} disabled={cmdLoading} />
    </div>
  );
}

function ActionBtn({
  icon, label, color, disabled, onClick,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly color: 'red' | 'blue' | 'green' | 'gray';
  readonly disabled: boolean;
  readonly onClick: (e: React.MouseEvent) => void;
}) {
  const colorMap = {
    red: 'text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30',
    blue: 'text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30',
    green: 'text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30',
    gray: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded disabled:opacity-40 transition-colors ${colorMap[color]}`}
    >
      {icon}
      {label}
    </button>
  );
}

function QuickCommandBar({
  serverId: _serverId,
  onSend,
  disabled,
}: {
  readonly serverId: string;
  readonly onSend: (cmd: string) => void;
  readonly disabled: boolean;
}) {
  const [cmd, setCmd] = useState('');
  const handleSend = () => {
    if (!cmd.trim()) return;
    onSend(cmd.trim());
    setCmd('');
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <Terminal className="w-3.5 h-3.5 text-gray-400" />
      <input
        type="text"
        value={cmd}
        onChange={(e) => setCmd(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
        placeholder="输入 Minecraft 命令 (如 say, weather, time set 等)..."
        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-xs"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !cmd.trim()}
        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-40 whitespace-nowrap shrink-0"
      >
        发送
      </button>
    </div>
  );
}
