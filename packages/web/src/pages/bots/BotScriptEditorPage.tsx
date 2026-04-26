import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDialogStore } from '../../stores/dialog.store.js';
import type { BotScript, BotScriptAction, BotScriptStep } from '@jian-agent/shared-protocol';
import { SCRIPT_PRESETS } from '@jian-agent/shared-protocol';
import { ScriptStepEditor } from './ScriptStepEditor.js';

type Tab = 'visual' | 'text' | 'templates';

const STORAGE_KEY = 'jian-agent:saved-scripts';

function loadScripts(): BotScript[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as BotScript[]; }
  catch { return []; }
}
function saveScripts(scripts: readonly BotScript[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
}

const PALETTE: { action: BotScriptAction; label: string; icon: string }[] = [
  { action: 'walk', label: '前进', icon: '🚶' },
  { action: 'turn', label: '转向', icon: '🔄' },
  { action: 'jump', label: '跳跃', icon: '⬆️' },
  { action: 'chat', label: '说话', icon: '💬' },
  { action: 'wait', label: '等待', icon: '⏳' },
  { action: 'attack', label: '攻击', icon: '⚔️' },
  { action: 'use_item', label: '使用物品', icon: '🎒' },
  { action: 'look', label: '看向', icon: '👁️' },
  { action: 'move_to', label: '移动到', icon: '📍' },
];

const PRESET_ICONS: Record<string, string> = {
  'preset-idle': '😴', 'preset-walk-random': '🚶', 'preset-patrol': '🔁',
  'preset-chat-spam': '💬', 'preset-combat': '⚔️', 'preset-follow': '👣',
};

/* ────── YAML helpers (no deps) ────── */
function scriptToYaml(s: BotScript): string {
  const lines: string[] = [`name: ${s.name}`, `loop: ${s.loop}`];
  if (s.loopCount !== undefined) lines.push(`loopCount: ${s.loopCount}`);
  lines.push('steps:');
  for (const st of s.steps) {
    lines.push(`  - action: ${st.action}`);
    const keys = Object.keys(st.params);
    if (keys.length > 0) {
      lines.push('    params:');
      for (const k of keys) lines.push(`      ${k}: ${JSON.stringify(st.params[k])}`);
    }
  }
  return lines.join('\n');
}
function yamlToScript(text: string, id: string): { script: BotScript | null; error: string } {
  try {
    const lines = text.split('\n').map((l) => l.trimEnd());
    let name = 'Untitled'; let loop = false; let loopCount: number | undefined;
    const steps: BotScriptStep[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith('name:')) { name = line.slice(5).trim(); i++; continue; }
      if (line.startsWith('loop:')) { loop = line.slice(5).trim() === 'true'; i++; continue; }
      if (line.startsWith('loopCount:')) { loopCount = Number(line.slice(10).trim()) || undefined; i++; continue; }
      if (line.trim().startsWith('- action:')) {
        const action = line.trim().slice('- action:'.length).trim() as BotScriptAction;
        const params: Record<string, unknown> = {};
        i++;
        if (i < lines.length && lines[i].trim() === 'params:') {
          i++;
          while (i < lines.length && lines[i].match(/^\s{6,}/)) {
            const m = lines[i].match(/^\s+(\w+):\s*(.+)/);
            if (m) { try { params[m[1]] = JSON.parse(m[2]); } catch { params[m[1]] = m[2]; } }
            i++;
          }
        }
        steps.push({ action, params });
        continue;
      }
      i++;
    }
    return { script: { id, name, loop, loopCount, steps }, error: '' };
  } catch (e) {
    return { script: null, error: String(e) };
  }
}

export function BotScriptEditorPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('visual');
  const [script, setScript] = useState<BotScript>({
    id: crypto.randomUUID(), name: '新脚本', loop: false, steps: [],
  });
  const [yamlText, setYamlText] = useState(() => scriptToYaml(script));
  const [yamlError, setYamlError] = useState('');

  /* ── Sync helpers ── */
  const updateScript = useCallback((s: BotScript) => {
    setScript(s); setYamlText(scriptToYaml(s)); setYamlError('');
  }, []);

  const handleTabChange = useCallback((t: Tab) => {
    if (tab === 'text') {
      const { script: parsed, error } = yamlToScript(yamlText, script.id);
      if (parsed) setScript(parsed); else setYamlError(error);
    }
    if (t === 'text') setYamlText(scriptToYaml(script));
    setTab(t);
  }, [tab, yamlText, script]);

  /* ── Step mutations (immutable) ── */
  const addStep = useCallback((action: BotScriptAction) => {
    updateScript({ ...script, steps: [...script.steps, { action, params: {} }] });
  }, [script, updateScript]);

  const changeStep = useCallback((idx: number, step: BotScriptStep) => {
    const steps = script.steps.map((s, i) => (i === idx ? step : s));
    updateScript({ ...script, steps });
  }, [script, updateScript]);

  const moveStep = useCallback((idx: number, dir: -1 | 1) => {
    const steps = [...script.steps];
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    [steps[idx], steps[target]] = [steps[target], steps[idx]];
    updateScript({ ...script, steps });
  }, [script, updateScript]);

  const removeStep = useCallback((idx: number) => {
    updateScript({ ...script, steps: script.steps.filter((_, i) => i !== idx) });
  }, [script, updateScript]);

  const handleSave = useCallback(() => {
    const existing = loadScripts();
    const idx = existing.findIndex((s) => s.id === script.id);
    const updated = idx >= 0
      ? existing.map((s, i) => (i === idx ? script : s))
      : [...existing, script];
    saveScripts(updated);
    useDialogStore.getState().showToast('脚本已保存', 'success');
  }, [script]);

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium cursor-pointer ${tab === t ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`;

  /* ── YAML tab: derived error ── */
  const yamlValidation = useMemo(() => {
    if (tab !== 'text') return '';
    return yamlError;
  }, [tab, yamlError]);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">脚本编辑器</h1>
      </div>

      {/* Script meta */}
      <div className="flex flex-wrap items-center gap-4">
        <input type="text" value={script.name} onChange={(e) => updateScript({ ...script, name: e.target.value })}
          className="px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 w-56" placeholder="脚本名称" />
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={script.loop} onChange={(e) => updateScript({ ...script, loop: e.target.checked })} /> 循环
        </label>
        {script.loop && (
          <input type="number" min={1} placeholder="循环次数 (空=无限)" value={script.loopCount ?? ''}
            onChange={(e) => updateScript({ ...script, loopCount: e.target.value ? Number(e.target.value) : undefined })}
            className="px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 w-40" />
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        <button type="button" className={tabCls('visual')} onClick={() => handleTabChange('visual')}>可视化编辑</button>
        <button type="button" className={tabCls('text')} onClick={() => handleTabChange('text')}>文本编辑</button>
        <button type="button" className={tabCls('templates')} onClick={() => handleTabChange('templates')}>模板</button>
      </div>

      {/* Tab bodies */}
      {tab === 'visual' && (
        <div className="flex gap-4">
          {/* Palette */}
          <div className="w-40 shrink-0 space-y-1 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">动作面板</p>
            {PALETTE.map((p) => (
              <button key={p.action} type="button" onClick={() => addStep(p.action)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                <span>{p.icon}</span>{p.label}
              </button>
            ))}
          </div>
          {/* Timeline */}
          <div className="flex-1 space-y-2 max-h-[60vh] overflow-y-auto">
            {script.steps.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">点击左侧动作添加步骤</p>
            )}
            {script.steps.map((step, i) => (
              <ScriptStepEditor key={i} step={step} index={i} total={script.steps.length}
                onChange={changeStep} onMove={moveStep} onRemove={removeStep} />
            ))}
          </div>
        </div>
      )}

      {tab === 'text' && (
        <div className="space-y-2">
          <textarea value={yamlText} onChange={(e) => {
            setYamlText(e.target.value);
            const { error } = yamlToScript(e.target.value, script.id);
            setYamlError(error);
          }}
            rows={16} spellCheck={false}
            className="w-full font-mono text-sm p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 resize-y" />
          {yamlValidation && <p className="text-xs text-danger-500">{yamlValidation}</p>}
        </div>
      )}

      {tab === 'templates' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {SCRIPT_PRESETS.map((preset) => (
            <button key={preset.id} type="button" onClick={() => { updateScript({ ...preset, id: script.id }); setTab('visual'); }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 text-left hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{PRESET_ICONS[preset.id] ?? '📄'}</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{preset.name}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{preset.steps.length} 个步骤 · {preset.loop ? '循环' : '单次'}</p>
            </button>
          ))}
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <button type="button" onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm rounded px-4 py-2">保存脚本</button>
        <button type="button" disabled
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded px-4 py-2">执行到选中Bot</button>
        <button type="button" onClick={() => navigate('/bots')}
          className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2">取消</button>
      </div>
    </div>
  );
}
