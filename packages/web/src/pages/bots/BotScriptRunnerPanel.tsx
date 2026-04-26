import { useState, useRef, useCallback } from 'react';
import {
  Play,
  Square,
  Repeat,
} from 'lucide-react';

const SCRIPT_PRESETS = [
  { label: '基本探索', code: '.pos\n.health\n.inv' },
  { label: '聊天压测', code: '.chat Hello from bot!\n.chat Testing 1 2 3\n.chat Stress test message' },
  { label: '运动测试', code: '.jump\n.forward\n.jump\n.back' },
  { label: '战斗侦察', code: '.health\n.pos\n.chat 开始侦察' },
] as const;

interface BotScriptRunnerPanelProps {
  readonly decodedName: string;
  readonly sendCommand: (cmd: string) => Promise<void>;
  readonly showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function BotScriptRunnerPanel({ decodedName, sendCommand, showToast }: BotScriptRunnerPanelProps) {
  const [scriptCode, setScriptCode] = useState('');
  const [loopCount, setLoopCount] = useState(1);
  const [loopInterval, setLoopInterval] = useState(1000);
  const [scriptRunning, setScriptRunning] = useState(false);
  const scriptAbortRef = useRef(false);

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

  return (
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
            className="flex-1 flex items-center justify-center gap-1.5 bg-success-600 text-white text-xs py-1.5 rounded hover:bg-success-500 active:scale-95 transition-all duration-150"
          >
            <Play className="w-3.5 h-3.5" />
            执行
          </button>
        ) : (
          <button
            onClick={handleScriptStop}
            className="flex-1 flex items-center justify-center gap-1.5 bg-danger-600 text-white text-xs py-1.5 rounded hover:bg-danger-500 active:scale-95 transition-all duration-150"
          >
            <Square className="w-3.5 h-3.5" />
            停止
          </button>
        )}
      </div>
    </div>
  );
}
