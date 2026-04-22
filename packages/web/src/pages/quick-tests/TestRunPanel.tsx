import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useQuickTestStore, type TestPhase } from '../../stores/quick-test.store.js';
import { botApi } from '../../api/bot.api.js';
import { useWsChannel } from '../../ws/use-ws-channel.js';
import { useWsRoom } from '../../hooks/useWsRoom.js';
import { WsChannel } from '@jian-agent/shared-protocol';

const MAX_SPARKLINE_POINTS = 60;

function Sparkline({ data }: { readonly data: readonly number[] }) {
  const { maxVal, points, gridLines } = useMemo(() => {
    const max = Math.max(1, ...data);
    const w = 400;
    const h = 80;
    const pad = 2;
    const innerH = h - pad * 2;
    const pts = data.map((v, i) => {
      const x = data.length === 1 ? w / 2 : (i / (data.length - 1)) * w;
      const y = pad + innerH - (v / max) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const lines = [0.25, 0.5, 0.75].map((f) => pad + innerH - f * innerH);
    return { maxVal: max, points: pts, gridLines: lines };
  }, [data]);

  if (data.length < 2) return null;

  return (
    <div className="space-y-1">
      <span className="text-xs text-gray-500 dark:text-gray-400">机器人在线趋势</span>
      <svg viewBox="0 0 400 80" className="w-full h-20" preserveAspectRatio="none">
        {gridLines.map((y) => (
          <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="0.5" />
        ))}
        <polyline fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" points={points.join(' ')} />
      </svg>
      <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500">
        <span>0</span>
        <span>{maxVal}</span>
      </div>
    </div>
  );
}

const PHASES: TestPhase[] = ['VALIDATING', 'CREATING', 'RUNNING', 'STOPPING', 'CLEANING', 'DONE'];

const phaseLabels: Record<string, string> = {
  VALIDATING: '校验',
  CREATING: '创建',
  RUNNING: '运行中',
  STOPPING: '停止',
  CLEANING: '清理',
  DONE: '完成',
  FAILED: '失败',
};

function PhaseIndicator({ current }: { readonly current: TestPhase }) {
  const idx = PHASES.indexOf(current);
  const isFailed = current === 'FAILED';

  return (
    <div className="flex items-center gap-1">
      {PHASES.map((p, i) => {
        let bg = 'bg-gray-600';
        if (isFailed && i === Math.max(0, idx)) bg = 'bg-red-500';
        else if (i < idx) bg = 'bg-green-500';
        else if (i === idx) bg = 'bg-blue-500 animate-pulse';

        return (
          <div key={p} className="flex items-center gap-1">
            <div className={`w-8 h-2 rounded ${bg}`} title={phaseLabels[p]} />
            {i < PHASES.length - 1 && <div className="w-2 h-0.5 bg-gray-600" />}
          </div>
        );
      })}
      <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">{phaseLabels[current] ?? current}</span>
    </div>
  );
}

export function TestRunPanel() {
  const { phase, config, startTime, errorMessage, createdNames } = useQuickTestStore();
  const endTest = useQuickTestStore((s) => s.endTest);
  const forceCleanup = useQuickTestStore((s) => s.forceCleanup);
  const reset = useQuickTestStore((s) => s.reset);

  const [elapsed, setElapsed] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineHistory, setOnlineHistory] = useState<readonly number[]>([]);
  const [logLines, setLogLines] = useState<string[]>([]);
  const logRef = useRef<HTMLPreElement>(null);

  // Elapsed timer
  useEffect(() => {
    if (phase !== 'RUNNING' || !startTime) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase, startTime]);

  // Poll stats & track sparkline data
  useEffect(() => {
    if (phase !== 'RUNNING' || !config) return;
    const id = setInterval(async () => {
      try {
        const res = await botApi.stats(config.serverId);
        const count = res.data.online;
        setOnlineCount(count);
        setOnlineHistory((prev) => {
          const next = [...prev, count];
          return next.length > MAX_SPARKLINE_POINTS ? next.slice(-MAX_SPARKLINE_POINTS) : next;
        });
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(id);
  }, [phase, config]);

  // Reset sparkline when test starts
  useEffect(() => {
    if (phase === 'CREATING') setOnlineHistory([]);
  }, [phase]);

  // Join WS room for server output
  const wsRooms = useMemo(
    () => (config ? [`server:${config.serverId}`] : []),
    [config],
  );
  useWsRoom(wsRooms);

  // WS log stream
  const handleLog = useCallback((data: unknown) => {
    const payload = data as { serverId?: string; stream?: string; chunk?: string; line?: string } | undefined;
    if (config && payload?.serverId && payload.serverId !== config.serverId) return;
    const line = payload?.chunk ?? payload?.line ?? (typeof data === 'string' ? data : JSON.stringify(data));
    setLogLines((prev) => {
      const next = [...prev, line];
      return next.length > 500 ? next.slice(-500) : next;
    });
  }, [config]);

  useWsChannel(config ? WsChannel.RESOURCE_SERVER_OUTPUT : ('' as WsChannel), handleLog);

  // Auto-scroll
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800/50 shadow-sm dark:shadow-none rounded-lg p-5 space-y-4">
      <PhaseIndicator current={phase} />

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-50 dark:bg-gray-900/60 rounded-lg p-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">机器人</span>
          <p className="text-lg font-semibold text-green-400">
            {onlineCount} / {createdNames.length}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/60 rounded-lg p-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">运行时长</span>
          <p className="text-lg font-semibold text-blue-400">{formatTime(elapsed)}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/60 rounded-lg p-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">行为</span>
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">{config?.behavior ?? '-'}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/60 rounded-lg p-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {config?.durationMinutes ? '剩余时间' : '模式'}
          </span>
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            {config?.durationMinutes
              ? formatTime(Math.max(0, config.durationMinutes * 60 - elapsed))
              : '手动控制'}
          </p>
        </div>
      </div>

      {/* Online count sparkline */}
      <Sparkline data={onlineHistory} />

      {/* Error */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded p-3 text-sm text-red-600 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      {/* Log stream */}
      <div>
        <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-1">服务器日志流</h3>
        <pre
          ref={logRef}
          className="bg-black/60 rounded p-3 text-xs text-gray-300 font-mono h-48 overflow-y-auto"
        >
          {logLines.length === 0 ? '等待日志...' : logLines.join('\n')}
        </pre>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {phase === 'RUNNING' && (
          <button
            type="button"
            onClick={endTest}
            className="bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded px-4 py-2"
          >
            提前结束测试
          </button>
        )}
        {phase === 'FAILED' && (
          <button
            type="button"
            onClick={forceCleanup}
            className="bg-red-600 hover:bg-red-500 text-white text-sm rounded px-4 py-2"
          >
            强制清理
          </button>
        )}
        {(phase === 'DONE' || phase === 'FAILED') && (
          <button
            type="button"
            onClick={reset}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 text-sm border border-gray-300 dark:border-gray-600 rounded px-4 py-2"
          >
            重置
          </button>
        )}
      </div>
    </div>
  );
}
