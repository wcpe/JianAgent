import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { botApi, type BotSnapshot, type BotInventoryItem, type BotNearbyEntity, type BotTerrainBlock } from '../../api/bot.api.js';
import { useWsChannel } from '../../ws/use-ws-channel.js';
import {
  ArrowLeft,
  Send,
  Play,
  MoveUp,
  MoveDown,
  MoveLeft,
  MoveRight,
  ArrowUpCircle,
  Footprints,
  Swords,
  RotateCcw,
  Terminal,
  Heart,
  Wifi,
  MapPin,
  RefreshCw,
  Square,
  Repeat,
  Package,
  Users,
  ChevronDown,
  ChevronRight,
  Map,
  Skull,
  AlertTriangle,
  Shield,
  Search,
  Trash2,
  X,
  FileText,
  Copy,
} from 'lucide-react';
import { useDialogStore } from '../../stores/dialog.store.js';

const SCRIPT_PRESETS = [
  { label: '基本探索', code: '.pos\n.health\n.inv' },
  { label: '聊天压测', code: '.chat Hello from bot!\n.chat Testing 1 2 3\n.chat Stress test message' },
  { label: '运动测试', code: '.jump\n.forward\n.jump\n.back' },
  { label: '战斗侦察', code: '.health\n.pos\n.chat 开始侦察' },
] as const;

/** Colorize a debug output line */
function getLineStyle(line: string): string {
  if (line.startsWith('[ERROR]') || line.includes('Error') || line.includes('error'))
    return 'text-red-400';
  if (line.startsWith('[WARN]') || line.includes('warn'))
    return 'text-amber-400';
  if (line.startsWith('>') || line.startsWith('[CMD]'))
    return 'text-green-400';
  if (line.startsWith('[INFO]') || line.includes('info'))
    return 'text-blue-400';
  if (line.startsWith('[CHAT]') || line.includes('<'))
    return 'text-cyan-300';
  return 'text-gray-300';
}

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
  const [cmdInput, setCmdInput] = useState('');
  const [debugLines, setDebugLines] = useState<readonly string[]>([]);
  const [scriptCode, setScriptCode] = useState('');
  const [loopCount, setLoopCount] = useState(1);
  const [loopInterval, setLoopInterval] = useState(1000);
  const [scriptRunning, setScriptRunning] = useState(false);
  const scriptAbortRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const showToast = useDialogStore((s) => s.showToast);

  // Command history
  const cmdHistoryRef = useRef<string[]>([]);
  const cmdHistoryIndex = useRef(-1);

  // Output filter
  const [outputFilter, setOutputFilter] = useState('');
  const [showOutputFilter, setShowOutputFilter] = useState(false);

  const [inventory, setInventory] = useState<BotInventoryItem[]>([]);
  const [nearbyEntities, setNearbyEntities] = useState<BotNearbyEntity[]>([]);
  const [terrain, setTerrain] = useState<BotTerrainBlock[]>([]);
  const [detailOpen, setDetailOpen] = useState<'inventory' | 'entities' | 'terrain' | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const terrainCanvasRef = useRef<HTMLCanvasElement>(null);

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

  // Scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [debugLines]);

  // Filtered lines
  const filteredLines = useMemo(() => {
    if (!outputFilter.trim()) return debugLines;
    const lower = outputFilter.toLowerCase();
    return debugLines.filter((line) => line.toLowerCase().includes(lower));
  }, [debugLines, outputFilter]);

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
    { label: '停止', icon: <Square className="w-4 h-4 text-red-400" />, cmd: '.stop' },
    { label: '位置', icon: <Footprints className="w-4 h-4" />, cmd: '.pos' },
    { label: '生命', icon: <Heart className="w-4 h-4" />, cmd: '.health' },
    { label: '背包', icon: <Package className="w-4 h-4" />, cmd: '.inv' },
  ];

  const handleScriptRun = useCallback(async () => {
    if (!scriptCode.trim() || !decodedName || scriptRunning) return;
    const lines = scriptCode.split('\n').filter((l) => l.trim());
    if (lines.length === 0) return;

    setScriptRunning(true);
    scriptAbortRef.current = false;
    const total = loopCount <= 0 ? Infinity : loopCount;

    for (let i = 0; i < total; i++) {
      if (scriptAbortRef.current) break;
      for (const line of lines) {
        if (scriptAbortRef.current) break;
        await sendCommand(line);
        // Small delay between lines within same iteration
        await new Promise((r) => setTimeout(r, 50));
      }
      if (i < total - 1 && !scriptAbortRef.current) {
        await new Promise((r) => setTimeout(r, loopInterval));
      }
    }

    setScriptRunning(false);
    if (!scriptAbortRef.current) {
      showToast(`脚本完成 (${lines.length} 行 × ${total === Infinity ? '∞' : total} 次)`, 'success');
    }
  }, [scriptCode, decodedName, scriptRunning, loopCount, loopInterval, sendCommand, showToast]);

  const handleScriptStop = useCallback(() => {
    scriptAbortRef.current = true;
    setScriptRunning(false);
    showToast('脚本已停止', 'info');
  }, [showToast]);

  const fetchBotDetail = useCallback(async () => {
    if (!decodedName) return;
    setDetailLoading(true);
    try {
      const res = await botApi.getDetail(decodedName);
      setInventory(res.data.inventory);
      setNearbyEntities(res.data.nearbyEntities);
      setTerrain(res.data.terrain ?? []);
    } catch {
      showToast('获取详细信息失败', 'error');
    } finally {
      setDetailLoading(false);
    }
  }, [decodedName, showToast]);

  // Render terrain on canvas
  useEffect(() => {
    const canvas = terrainCanvasRef.current;
    if (!canvas || terrain.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const BLOCK_COLORS: Record<string, string> = {
      grass_block: '#5d9b3a', short_grass: '#5d9b3a', tall_grass: '#4a8030',
      dirt: '#8b6914', coarse_dirt: '#7a5c10', rooted_dirt: '#6b4f0e',
      stone: '#888888', cobblestone: '#777777', deepslate: '#555555',
      granite: '#9a6b4a', diorite: '#c0b0a0', andesite: '#999999',
      sand: '#e8d68a', red_sand: '#c08040', gravel: '#8a7a6a',
      water: '#3366cc', oak_log: '#6b5030', spruce_log: '#3b2810',
      birch_log: '#c0b090', oak_leaves: '#3a7a20', spruce_leaves: '#2a5a10',
      birch_leaves: '#4a9a30', oak_planks: '#b08a50', snow: '#f0f0ff',
      snow_block: '#f0f0ff', ice: '#8ac8ff', packed_ice: '#7ab8ef',
      clay: '#a0a0b0', bedrock: '#333333', obsidian: '#1a0a2e',
      netherrack: '#6a2020', end_stone: '#d8d0a0', mycelium: '#7a6a8a',
      podzol: '#5a4a20', moss_block: '#4a7a30',
    };

    const getColor = (name: string): string => {
      if (BLOCK_COLORS[name]) return BLOCK_COLORS[name];
      if (name.includes('log') || name.includes('wood')) return '#6b5030';
      if (name.includes('leaves')) return '#3a7a20';
      if (name.includes('stone') || name.includes('ore')) return '#888888';
      if (name.includes('sand')) return '#e8d68a';
      if (name.includes('water')) return '#3366cc';
      if (name.includes('lava')) return '#cc4400';
      if (name.includes('snow') || name.includes('ice')) return '#d0e8ff';
      if (name.includes('plank') || name.includes('fence') || name.includes('door')) return '#b08a50';
      return '#666666';
    };

    // Find bounds
    const xs = terrain.map((b) => b.x);
    const zs = terrain.map((b) => b.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const rangeX = maxX - minX + 1;
    const rangeZ = maxZ - minZ + 1;
    const PIXEL = Math.max(1, Math.min(8, Math.floor(256 / Math.max(rangeX, rangeZ))));
    canvas.width = rangeX * PIXEL;
    canvas.height = rangeZ * PIXEL;

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const block of terrain) {
      ctx.fillStyle = getColor(block.name);
      ctx.fillRect((block.x - minX) * PIXEL, (block.z - minZ) * PIXEL, PIXEL, PIXEL);
    }

    // Draw bot marker at center
    if (bot) {
      const bx = Math.round(bot.x) - minX;
      const bz = Math.round(bot.z) - minZ;
      ctx.fillStyle = '#ff3333';
      const markerSize = Math.max(PIXEL, 3);
      ctx.fillRect(bx * PIXEL - Math.floor(markerSize / 2), bz * PIXEL - Math.floor(markerSize / 2), markerSize, markerSize);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx * PIXEL - Math.floor(markerSize / 2), bz * PIXEL - Math.floor(markerSize / 2), markerSize, markerSize);
    }
  }, [terrain, bot]);

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
          <span className={`w-2.5 h-2.5 rounded-full ${bot?.state === 'SPAWNED' || bot?.state === 'DEBUGGING' || bot?.state === 'READY' || bot?.state === 'RUNNING_PHASE' ? 'bg-green-500' : bot?.state === 'DEAD' ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
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
        <div className="border-b border-red-500/30 bg-gradient-to-r from-red-950/60 to-red-900/40">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Skull className="w-5 h-5 text-red-400 animate-pulse" />
              <span className="font-semibold text-red-200 text-sm">机器人已死亡</span>
            </div>
            <div className="flex items-center gap-4 ml-4 text-xs text-red-300/80">
              {(bot.deathCount ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  累计死亡 <strong className="text-red-200">{bot.deathCount}</strong> 次
                </span>
              )}
              {bot.deathCount >= 2 && (
                <span className="flex items-center gap-1 text-amber-400">
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
            <div className="px-4 pb-2 flex items-start gap-1.5 text-[11px] text-red-300/70">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>最后错误: {bot.lastError}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Debug terminal */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-gray-400 text-xs border-b border-gray-700">
            <Terminal className="w-3.5 h-3.5" />
            <span>调试输出</span>
            <span className="text-gray-600 ml-1">({debugLines.length})</span>
            {debugActive && <span className="text-green-400 ml-1">已连接</span>}
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={() => setShowOutputFilter((v) => !v)}
                className={`p-1 rounded hover:bg-gray-700 transition-colors ${showOutputFilter ? 'text-blue-400' : 'text-gray-500'}`}
                title="搜索输出 (Ctrl+F)"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  const text = debugLines.join('\n');
                  navigator.clipboard.writeText(text).then(() => showToast('已复制到剪贴板', 'success'));
                }}
                className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
                title="复制全部输出"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDebugLines([])}
                className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400 transition-colors"
                title="清空输出"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* Output filter bar */}
          {showOutputFilter && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-850 border-b border-gray-700">
              <Search className="w-3 h-3 text-gray-500" />
              <input
                type="text"
                placeholder="过滤输出..."
                value={outputFilter}
                onChange={(e) => setOutputFilter(e.target.value)}
                className="flex-1 bg-transparent text-gray-300 text-xs outline-none placeholder-gray-600 font-mono"
                autoFocus
              />
              {outputFilter && (
                <>
                  <span className="text-[10px] text-gray-500">{filteredLines.length}/{debugLines.length}</span>
                  <button onClick={() => setOutputFilter('')} className="text-gray-500 hover:text-gray-300">
                    <X className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          )}
          <div ref={scrollRef} className="flex-1 bg-gray-950 overflow-y-auto p-3 font-mono text-xs leading-5">
            {filteredLines.map((line, i) => (
              <div key={i} className={`whitespace-pre-wrap break-all ${getLineStyle(line)}`}>{line}</div>
            ))}
            {debugLines.length === 0 && (
              <span className="text-gray-600">等待调试输出...</span>
            )}
          </div>

          {/* Command input with history */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border-t border-gray-700">
            <span className="text-green-400 text-xs font-mono">{'>'}</span>
            <input
              type="text"
              placeholder="输入命令 (↑↓ 历史, 不带/发言, 带/游戏命令, .内部命令)"
              value={cmdInput}
              onChange={(e) => setCmdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  const history = cmdHistoryRef.current;
                  if (history.length === 0) return;
                  const idx = cmdHistoryIndex.current === -1 ? history.length - 1 : Math.max(0, cmdHistoryIndex.current - 1);
                  cmdHistoryIndex.current = idx;
                  setCmdInput(history[idx]);
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  const history = cmdHistoryRef.current;
                  if (cmdHistoryIndex.current === -1) return;
                  const idx = cmdHistoryIndex.current + 1;
                  if (idx >= history.length) {
                    cmdHistoryIndex.current = -1;
                    setCmdInput('');
                  } else {
                    cmdHistoryIndex.current = idx;
                    setCmdInput(history[idx]);
                  }
                } else if (e.key === 'Enter') {
                  const text = cmdInput.trim();
                  if (!text) return;
                  if (text.startsWith('/')) {
                    sendCommand(`.cmd ${text.slice(1)}`);
                  } else if (text.startsWith('.')) {
                    sendCommand(text);
                  } else {
                    sendCommand(`.chat ${text}`);
                  }
                  setCmdInput('');
                }
              }}
              className="flex-1 bg-transparent text-gray-200 text-sm outline-none placeholder-gray-600 font-mono"
            />
          </div>
        </div>

        {/* Right: Controls panel */}
        <div className="w-80 bg-gray-50 dark:bg-gray-800/50 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-y-auto">
          {/* Real-time Status */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">实时状态</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white dark:bg-gray-900 rounded p-2">
                <div className="flex items-center gap-1 text-[10px] text-gray-400"><Heart className="w-3 h-3 text-red-400" />生命</div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{bot?.health?.toFixed(1) ?? '—'}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded p-2">
                <div className="flex items-center gap-1 text-[10px] text-gray-400">🍖 饱食度</div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{bot?.food ?? '—'}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded p-2">
                <div className="flex items-center gap-1 text-[10px] text-gray-400"><Wifi className="w-3 h-3 text-blue-400" />延迟</div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{bot?.latencyMs ? `${bot.latencyMs}ms` : '—'}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded p-2">
                <div className="flex items-center gap-1 text-[10px] text-gray-400"><MapPin className="w-3 h-3 text-green-400" />世界</div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate" title={bot?.world}>{bot?.world || '—'}</p>
              </div>
              <div className="col-span-2 bg-white dark:bg-gray-900 rounded p-2">
                <div className="flex items-center gap-1 text-[10px] text-gray-400"><MapPin className="w-3 h-3 text-yellow-400" />坐标</div>
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
                <div className="col-span-2 bg-red-50 dark:bg-red-900/30 rounded p-2">
                  <div className="text-[10px] text-red-400">最近错误</div>
                  <p className="text-xs text-red-600 dark:text-red-300 truncate" title={bot.lastError}>{bot.lastError}</p>
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

          {/* Inventory + Nearby Entities */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">背包 / 附近实体</h3>
              <button
                onClick={fetchBotDetail}
                disabled={detailLoading}
                className="ml-auto text-[10px] flex items-center gap-1 px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${detailLoading ? 'animate-spin' : ''}`} /> 刷新
              </button>
            </div>

            {/* Inventory Section */}
            <button
              onClick={() => { setDetailOpen(detailOpen === 'inventory' ? null : 'inventory'); if (!inventory.length) fetchBotDetail(); }}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 mb-1"
            >
              {detailOpen === 'inventory' ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <Package className="w-3.5 h-3.5 text-amber-500" />
              <span>背包</span>
              <span className="ml-auto text-gray-400">{inventory.length} 物品</span>
            </button>
            {detailOpen === 'inventory' && (
              <div className="max-h-40 overflow-y-auto mb-1">
                {inventory.length === 0 ? (
                  <p className="text-[10px] text-gray-400 px-2 py-1">暂无物品（点击刷新获取）</p>
                ) : (
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-gray-400 text-left">
                        <th className="px-1 py-0.5">物品</th>
                        <th className="px-1 py-0.5 text-right">数量</th>
                        <th className="px-1 py-0.5 text-right">槽位</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map((item) => (
                        <tr key={item.slot} className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                          <td className="px-1 py-0.5 truncate max-w-[120px]" title={item.name}>{item.displayName}</td>
                          <td className="px-1 py-0.5 text-right font-mono">{item.count}</td>
                          <td className="px-1 py-0.5 text-right text-gray-400">{item.slot}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Nearby Entities Section */}
            <button
              onClick={() => { setDetailOpen(detailOpen === 'entities' ? null : 'entities'); if (!nearbyEntities.length) fetchBotDetail(); }}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 mb-1"
            >
              {detailOpen === 'entities' ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <Users className="w-3.5 h-3.5 text-cyan-500" />
              <span>附近实体</span>
              <span className="ml-auto text-gray-400">{nearbyEntities.length} 个</span>
            </button>
            {detailOpen === 'entities' && (
              <div className="max-h-40 overflow-y-auto">
                {nearbyEntities.length === 0 ? (
                  <p className="text-[10px] text-gray-400 px-2 py-1">未检测到附近实体（点击刷新获取）</p>
                ) : (
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-gray-400 text-left">
                        <th className="px-1 py-0.5">名称</th>
                        <th className="px-1 py-0.5">类型</th>
                        <th className="px-1 py-0.5 text-right">距离</th>
                        <th className="px-1 py-0.5 text-right">HP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nearbyEntities.map((e) => (
                        <tr key={e.id} className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                          <td className="px-1 py-0.5 truncate max-w-[80px]" title={e.name ?? ''}>{e.name ?? `#${e.id}`}</td>
                          <td className="px-1 py-0.5 text-gray-400">{e.type}</td>
                          <td className="px-1 py-0.5 text-right font-mono">{e.distance}m</td>
                          <td className="px-1 py-0.5 text-right font-mono text-red-400">{e.health ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Terrain Map Section */}
            <button
              onClick={() => { setDetailOpen(detailOpen === 'terrain' ? null : 'terrain'); if (!terrain.length) fetchBotDetail(); }}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 mb-1"
            >
              {detailOpen === 'terrain' ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <Map className="w-3.5 h-3.5 text-emerald-500" />
              <span>周围地形</span>
              <span className="ml-auto text-gray-400">{terrain.length > 0 ? `${terrain.length} 方块` : ''}</span>
            </button>
            {detailOpen === 'terrain' && (
              <div className="flex flex-col items-center gap-1 p-1">
                {terrain.length === 0 ? (
                  <p className="text-[10px] text-gray-400">暂无地形数据（点击刷新获取）</p>
                ) : (
                  <>
                    <canvas
                      ref={terrainCanvasRef}
                      className="border border-gray-600 rounded"
                      style={{ imageRendering: 'pixelated', width: '100%', maxWidth: 256, aspectRatio: '1/1' }}
                    />
                    <div className="flex flex-wrap gap-2 text-[9px] text-gray-400">
                      <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#5d9b3a' }} />草地</span>
                      <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#888888' }} />石头</span>
                      <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#3366cc' }} />水</span>
                      <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#6b5030' }} />木</span>
                      <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#e8d68a' }} />沙</span>
                      <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm bg-red-500" />机器人</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

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
          <div className="p-3 flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">实时脚本</h3>
              <div className="flex items-center gap-1">
                <select
                  onChange={(e) => {
                    const preset = SCRIPT_PRESETS[Number(e.target.value)];
                    if (preset) setScriptCode(preset.code);
                    e.target.value = '';
                  }}
                  className="bg-gray-700 text-gray-300 text-[10px] rounded px-1.5 py-0.5 border border-gray-600 outline-none"
                  defaultValue=""
                >
                  <option value="" disabled>预设脚本...</option>
                  {SCRIPT_PRESETS.map((p, i) => (
                    <option key={i} value={i}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <textarea
              value={scriptCode}
              onChange={(e) => setScriptCode(e.target.value)}
              placeholder={".chat Hello\n.jump\n.pos"}
              rows={6}
              disabled={scriptRunning}
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs font-mono text-gray-800 dark:text-gray-200 resize-none disabled:opacity-50"
            />
            {/* Loop controls */}
            <div className="flex items-center gap-2 mt-1.5">
              <Repeat className="w-3 h-3 text-gray-400" />
              <label className="text-[10px] text-gray-500 dark:text-gray-400">循环</label>
              <input
                type="number"
                min={0}
                value={loopCount}
                onChange={(e) => setLoopCount(parseInt(e.target.value) || 0)}
                className="w-14 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5 text-xs text-gray-800 dark:text-gray-200 text-center"
                title="0 = 无限循环"
              />
              <label className="text-[10px] text-gray-500 dark:text-gray-400">次</label>
              <div className="flex-1" />
              <label className="text-[10px] text-gray-500 dark:text-gray-400">间隔</label>
              <input
                type="number"
                min={100}
                step={100}
                value={loopInterval}
                onChange={(e) => setLoopInterval(parseInt(e.target.value) || 1000)}
                className="w-16 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5 text-xs text-gray-800 dark:text-gray-200 text-center"
              />
              <label className="text-[10px] text-gray-500 dark:text-gray-400">ms</label>
            </div>
            <div className="flex gap-1.5 mt-1.5">
              {!scriptRunning ? (
                <button
                  onClick={handleScriptRun}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white text-xs py-1.5 rounded hover:bg-green-500 active:scale-95 transition-all duration-150"
                >
                  <Play className="w-3.5 h-3.5" />
                  执行
                </button>
              ) : (
                <button
                  onClick={handleScriptStop}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 text-white text-xs py-1.5 rounded hover:bg-red-500 active:scale-95 transition-all duration-150"
                >
                  <Square className="w-3.5 h-3.5" />
                  停止
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
