import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { botApi, type BotSnapshot } from '../../api/bot.api.js';
import { useWsChannel } from '../../ws/use-ws-channel.js';
import {
  ArrowLeft,
  Send,
  MoveUp,
  MoveDown,
  MoveLeft,
  MoveRight,
  ArrowUpCircle,
  Footprints,
  RotateCcw,
  Heart,
  RefreshCw,
  Square,
  Package,
  Skull,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import { useDialogStore } from '../../stores/dialog.store.js';
import { DebugTerminalPanel } from './DebugTerminalPanel.js';
import { BotConsoleStatusPanel } from './BotConsoleStatusPanel.js';
import { BotInventoryDetailPanel } from './BotInventoryDetailPanel.js';
import { BotScriptRunnerPanel } from './BotScriptRunnerPanel.js';

const ALL_BEHAVIORS = [
  { id: 'idle', label: '静止' },
  { id: 'walk_random', label: '随机行走' },
  { id: 'jump', label: '跳跃' },
  { id: 'follow', label: '跟随玩家' },
  { id: 'pvp_attack', label: 'PVP 攻击' },
  { id: 'attack', label: '攻击实体' },
  { id: 'gather', label: '挖矿收集' },
  { id: 'chat_spam', label: '聊天刷屏' },
  { id: 'look', label: '环顾' },
  { id: 'move_to', label: '寻路移动' },
  { id: 'interact', label: '交互方块' },
  { id: 'patrol', label: '巡逻' },
] as const;

/** Quick action button with brief visual feedback */
function QuickActionButton({
  action,
  sendCommand,
}: {
  readonly action: { readonly label: string; readonly icon: React.ReactNode; readonly cmd: string };
  readonly sendCommand: (cmd: string) => Promise<void>;
}) {
  const [pressed, setPressed] = useState(false);
  const handleClick = useCallback(() => {
    setPressed(true);
    sendCommand(action.cmd);
    setTimeout(() => setPressed(false), 300);
  }, [action.cmd, sendCommand]);

  return (
    <button
      onClick={handleClick}
      className={`flex flex-col items-center gap-1 p-2 rounded text-xs border transition-all duration-100 active:scale-90 ${
        pressed
          ? 'bg-blue-600 text-white border-blue-600 scale-95'
          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      {action.icon}
      {action.label}
    </button>
  );
}

/** Behavior button with loading spinner on switch */
function BehaviorButton({
  behavior,
  botName,
  currentBehavior,
  showToast,
}: {
  readonly behavior: { readonly id: string; readonly label: string };
  readonly botName: string;
  readonly currentBehavior?: string;
  readonly showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}) {
  const [switching, setSwitching] = useState(false);
  const isCurrent = currentBehavior === behavior.id;

  const handleClick = useCallback(async () => {
    if (switching) return;
    setSwitching(true);
    try {
      await botApi.setBehavior(botName, behavior.id);
      showToast(`行为切换: ${behavior.label}`, 'success');
    } catch {
      showToast('行为切换失败', 'error');
    } finally {
      setSwitching(false);
    }
  }, [switching, botName, behavior.id, behavior.label, showToast]);

  return (
    <button
      onClick={handleClick}
      disabled={switching}
      className={`px-2 py-1.5 text-xs rounded border active:scale-90 transition-all duration-100 disabled:opacity-60 ${
        isCurrent
          ? 'bg-blue-600 text-white border-blue-600 ring-1 ring-blue-400/50'
          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      {switching ? <RotateCcw className="w-3 h-3 animate-spin inline mr-1" /> : null}
      {behavior.label}
    </button>
  );
}

export function BotConsolePage() {
  const { botName } = useParams<{ botName: string }>();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(botName ?? '');

  const [bot, setBot] = useState<BotSnapshot | null>(null);
  const [debugActive, setDebugActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatMsg, setChatMsg] = useState('');
  const [debugLines, setDebugLines] = useState<readonly string[]>([]);
  const showToast = useDialogStore((s) => s.showToast);

  // Command history (kept here for sendCommand callback)
  const cmdHistoryRef = useRef<string[]>([]);
  const cmdHistoryIndex = useRef(-1);

  // Fetch bot info — poll every 3s for live status
  useEffect(() => {
    if (!decodedName) return;
    setLoading(true);
    botApi.getOne(decodedName)
      .then((res) => setBot(res.data))
      .catch(() => setBot(null))
      .finally(() => setLoading(false));

    const interval = setInterval(() => {
      botApi.getOne(decodedName)
        .then((res) => setBot(res.data))
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [decodedName]);

  // Start debug session on mount
  useEffect(() => {
    if (!decodedName) return;
    botApi.debugStart(decodedName)
      .then(() => setDebugActive(true))
      .catch(() => { /* might already be started */ });

    return () => {
      botApi.debugStop(decodedName).catch(() => {});
    };
  }, [decodedName]);

  // Listen for debug output via WS
  const handleDebugOutput = useCallback((payload: { data: string }) => {
    setDebugLines((prev) => {
      const next = [...prev, payload.data];
      return next.length > 500 ? next.slice(-500) : next;
    });
  }, []);
  useWsChannel(`terminal-session:bot-debug:output:${decodedName}`, handleDebugOutput);

  // Send debug command (with history tracking)
  const sendCommand = useCallback(async (cmd: string) => {
    if (!decodedName || !cmd.trim()) return;
    // Track history for interactive commands
    const history = cmdHistoryRef.current;
    if (history[history.length - 1] !== cmd.trim()) {
      history.push(cmd.trim());
      if (history.length > 100) history.shift();
    }
    cmdHistoryIndex.current = -1;
    try {
      await botApi.debugCommand(decodedName, cmd.trim());
    } catch {
      setDebugLines((prev) => [...prev, `[ERROR] Failed to send command: ${cmd}`]);
      useDialogStore.getState().showToast(`命令发送失败: ${cmd}`, 'error');
    }
  }, [decodedName]);

  // Chat action
  const handleChat = useCallback(() => {
    if (!chatMsg.trim()) return;
    sendCommand(`.chat ${chatMsg}`);
    setChatMsg('');
  }, [chatMsg, sendCommand]);

  // Quick actions
  const quickActions = [
    { label: '前进', icon: <MoveUp className="w-4 h-4" />, cmd: '.forward' },
    { label: '后退', icon: <MoveDown className="w-4 h-4" />, cmd: '.back' },
    { label: '跳跃', icon: <ArrowUpCircle className="w-4 h-4" />, cmd: '.jump' },
    { label: '左移', icon: <MoveLeft className="w-4 h-4" />, cmd: '.left' },
    { label: '右移', icon: <MoveRight className="w-4 h-4" />, cmd: '.right' },
    { label: '停止', icon: <Square className="w-4 h-4 text-danger-400" />, cmd: '.stop' },
    { label: '位置', icon: <Footprints className="w-4 h-4" />, cmd: '.pos' },
    { label: '生命', icon: <Heart className="w-4 h-4" />, cmd: '.health' },
    { label: '背包', icon: <Package className="w-4 h-4" />, cmd: '.inv' },
  ];

  if (loading) {
    return <div className="p-6 text-gray-500 dark:text-gray-400">加载中...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => navigate('/bots')}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${bot?.state === 'SPAWNED' || bot?.state === 'DEBUGGING' || bot?.state === 'READY' || bot?.state === 'RUNNING_PHASE' ? 'bg-success-500' : bot?.state === 'DEAD' ? 'bg-danger-500 animate-pulse' : 'bg-gray-500'}`} />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{decodedName}</h1>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {bot?.state ?? 'unknown'} | {bot?.currentBehavior ?? 'idle'}
        </span>
        {(bot?.state === 'DISCONNECTED' || bot?.state === 'FAILED' || bot?.state === 'STOPPED') && (
          <button
            onClick={async () => {
              try {
                await botApi.batchReconnect([decodedName]);
                showToast('已发送重连指令', 'success');
              } catch { showToast('重连失败', 'error'); }
            }}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 active:scale-95 transition-all duration-150"
          >
            <RefreshCw className="w-3.5 h-3.5" /> 重新连接
          </button>
        )}
      </div>

      {/* Death detail panel */}
      {(bot?.isDead || bot?.state === 'DEAD') && (
        <div className="border-b border-danger-500/30 bg-gradient-to-r from-danger-700/60 to-danger-700/40">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Skull className="w-5 h-5 text-danger-400 animate-pulse" />
              <span className="font-semibold text-danger-200 text-sm">机器人已死亡</span>
            </div>
            <div className="flex items-center gap-4 ml-4 text-xs text-danger-200/80">
              {(bot.deathCount ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  累计死亡 <strong className="text-danger-200">{bot.deathCount}</strong> 次
                </span>
              )}
              {bot.deathCount >= 2 && (
                <span className="flex items-center gap-1 text-warning-400">
                  <AlertTriangle className="w-3 h-3" />
                  快速死亡保护已触发
                </span>
              )}
            </div>
            <button
              onClick={async () => {
                try {
                  await botApi.respawn(decodedName);
                  showToast('已发送复活指令 — 快速死亡保护已清除', 'success');
                } catch { showToast('复活失败', 'error'); }
              }}
              className="ml-auto flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded transition-colors active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              强制复活
            </button>
          </div>
          {bot.lastError && (
            <div className="px-4 pb-2 flex items-start gap-1.5 text-[11px] text-danger-200/70">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>最后错误: {bot.lastError}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Debug terminal */}
        <DebugTerminalPanel
          debugLines={debugLines}
          debugActive={debugActive}
          sendCommand={sendCommand}
          setDebugLines={setDebugLines}
          showToast={showToast}
        />

        {/* Right: Controls panel */}
        <div className="w-80 bg-gray-50 dark:bg-gray-800/50 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-y-auto">
          {/* Real-time Status */}
          <BotConsoleStatusPanel bot={bot} decodedName={decodedName} setBot={setBot} />

          {/* Chat */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">聊天</h3>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="发送消息..."
                value={chatMsg}
                onChange={(e) => setChatMsg(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-800 dark:text-gray-200"
              />
              <button
                onClick={handleChat}
                className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-500 active:scale-90 transition-all duration-150"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">快捷操作</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {quickActions.map((action) => (
                <QuickActionButton key={action.cmd} action={action} sendCommand={sendCommand} />
              ))}
            </div>
          </div>

          {/* Inventory + Nearby Entities + Terrain */}
          <BotInventoryDetailPanel decodedName={decodedName} bot={bot} showToast={showToast} />

          {/* Behavior */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">行为控制</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_BEHAVIORS.map((b) => (
                <BehaviorButton key={b.id} behavior={b} botName={decodedName} currentBehavior={bot?.currentBehavior} showToast={showToast} />
              ))}
            </div>
          </div>

          {/* Script */}
          <BotScriptRunnerPanel decodedName={decodedName} sendCommand={sendCommand} showToast={showToast} />
        </div>
      </div>
    </div>
  );
}
