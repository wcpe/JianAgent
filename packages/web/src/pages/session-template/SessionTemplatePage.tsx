import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionTemplateApi, type SessionTemplateDto } from '../../api/session-template.api.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import { StyledSelect } from '../../components/ui/StyledSelect.js';

/* ── Constants ── */

const BEHAVIORS = [
  { value: 'idle', label: 'idle — 静止' },
  { value: 'walk_random', label: 'walk_random — 随机行走' },
  { value: 'chat_spam', label: 'chat_spam — 聊天刷屏' },
  { value: 'patrol', label: 'patrol — 巡逻' },
  { value: 'follow', label: 'follow — 跟随' },
  { value: 'combat', label: 'combat — 战斗' },
  { value: 'build', label: 'build — 建造' },
  { value: 'mine', label: 'mine — 挖矿' },
  { value: 'pvp', label: 'pvp — 玩家对战' },
  { value: 'explore', label: 'explore — 探索' },
] as const;

interface PhaseItem {
  readonly phase: string;
  readonly botCount: number;
  readonly behavior: string;
  readonly durationSec: number;
}

interface BotConfig {
  readonly namePrefix: string;
  readonly count: number;
  readonly behavior: string;
}

const DEFAULT_PHASE: PhaseItem = { phase: '阶段 1', botCount: 5, behavior: 'idle', durationSec: 60 };
const DEFAULT_BOT_CONFIG: BotConfig = { namePrefix: 'Bot', count: 5, behavior: 'idle' };

const PRESET_PHASES: Record<string, readonly PhaseItem[]> = {
  single: [{ phase: '单阶段', botCount: 10, behavior: 'idle', durationSec: 120 }],
  ramp: [
    { phase: '预热', botCount: 3, behavior: 'idle', durationSec: 30 },
    { phase: '加压', botCount: 10, behavior: 'walk_random', durationSec: 60 },
    { phase: '高峰', botCount: 20, behavior: 'combat', durationSec: 120 },
  ],
  full: [
    { phase: '预热', botCount: 3, behavior: 'idle', durationSec: 30 },
    { phase: '加压', botCount: 15, behavior: 'walk_random', durationSec: 60 },
    { phase: '峰值', botCount: 30, behavior: 'pvp', durationSec: 120 },
    { phase: '冷却', botCount: 5, behavior: 'idle', durationSec: 30 },
  ],
};

/* ── Styles ── */

const inputCls = 'w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm text-gray-800 dark:text-gray-200';
const labelCls = 'block text-sm text-gray-500 dark:text-gray-400 mb-1';
const cardCls = 'bg-white dark:bg-gray-800/50 shadow-sm dark:shadow-none rounded-lg p-4';

/* ── Sub-components ── */

function BotConfigForm({ config, onChange }: { readonly config: BotConfig; readonly onChange: (c: BotConfig) => void }) {
  return (
    <div className={`${cardCls} space-y-3`}>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Bot 配置</h3>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>名称前缀</label>
          <input className={inputCls} value={config.namePrefix} onChange={(e) => onChange({ ...config, namePrefix: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>数量 (1-100)</label>
          <input className={inputCls} type="number" min={1} max={100} value={config.count} onChange={(e) => onChange({ ...config, count: Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)) })} />
        </div>
        <div>
          <label className={labelCls}>行为</label>
          <StyledSelect className={inputCls} value={config.behavior} onChange={(e) => onChange({ ...config, behavior: e.target.value })}>
            {BEHAVIORS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </StyledSelect>
        </div>
      </div>
    </div>
  );
}

function PhaseCard({ phase, index, onChange, onRemove }: {
  readonly phase: PhaseItem; readonly index: number;
  readonly onChange: (i: number, p: PhaseItem) => void; readonly onRemove: (i: number) => void;
}) {
  return (
    <div className={`${cardCls} relative`}>
      <button onClick={() => onRemove(index)} className="absolute top-2 right-2 text-red-400 hover:text-red-300 text-xs" title="删除阶段">✕</button>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className={labelCls}>阶段名称</label>
          <input className={inputCls} value={phase.phase} onChange={(e) => onChange(index, { ...phase, phase: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Bot 数量</label>
          <input className={inputCls} type="number" min={1} max={100} value={phase.botCount} onChange={(e) => onChange(index, { ...phase, botCount: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
        </div>
        <div>
          <label className={labelCls}>行为</label>
          <StyledSelect className={inputCls} value={phase.behavior} onChange={(e) => onChange(index, { ...phase, behavior: e.target.value })}>
            {BEHAVIORS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </StyledSelect>
        </div>
        <div>
          <label className={labelCls}>时长 (秒)</label>
          <input className={inputCls} type="number" min={1} value={phase.durationSec} onChange={(e) => onChange(index, { ...phase, durationSec: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
        </div>
      </div>
    </div>
  );
}

function PhasePresetBar({ onApply }: { readonly onApply: (phases: readonly PhaseItem[]) => void }) {
  return (
    <div className="flex gap-2">
      <span className={labelCls + ' self-center'}>预设:</span>
      <button onClick={() => onApply(PRESET_PHASES.single)} className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600">单阶段</button>
      <button onClick={() => onApply(PRESET_PHASES.ramp)} className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600">渐进</button>
      <button onClick={() => onApply(PRESET_PHASES.full)} className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600">完整</button>
    </div>
  );
}

/* ── Main Page ── */

export function SessionTemplatePage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<readonly SessionTemplateDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [botConfig, setBotConfig] = useState<BotConfig>(DEFAULT_BOT_CONFIG);
  const [phases, setPhases] = useState<readonly PhaseItem[]>([DEFAULT_PHASE]);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sessionTemplateApi.list();
      setTemplates(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const resetForm = useCallback(() => {
    setFormName('');
    setFormDesc('');
    setBotConfig(DEFAULT_BOT_CONFIG);
    setPhases([DEFAULT_PHASE]);
    setShowForm(false);
  }, []);

  const handleCreate = useCallback(async () => {
    try {
      await sessionTemplateApi.create({
        name: formName,
        description: formDesc,
        botConfig: botConfig as unknown as Record<string, unknown>,
        phases: phases as unknown as Record<string, unknown>[],
      });
      resetForm();
      await fetchTemplates();
    } catch (err) {
      useDialogStore.getState().showToast(err instanceof Error ? err.message : '创建模板失败', 'error');
    }
  }, [formName, formDesc, botConfig, phases, resetForm, fetchTemplates]);

  const handleDelete = useCallback(async (id: string) => {
    await sessionTemplateApi.delete(id);
    await fetchTemplates();
  }, [fetchTemplates]);

  const handleCreateSession = useCallback(async (templateId: string) => {
    await sessionTemplateApi.createSession(templateId);
    useDialogStore.getState().showToast('会话已创建', 'success');
    navigate('/sessions');
  }, [navigate]);

  const updatePhase = useCallback((index: number, updated: PhaseItem) => {
    setPhases((prev) => prev.map((p, i) => (i === index ? updated : p)));
  }, []);

  const removePhase = useCallback((index: number) => {
    setPhases((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addPhase = useCallback(() => {
    setPhases((prev) => [...prev, { ...DEFAULT_PHASE, phase: `阶段 ${prev.length + 1}` }]);
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">会话模板</h1>
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
        >
          {showForm ? '取消' : '新建模板'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800/50 shadow-sm dark:shadow-none rounded-lg p-6 space-y-5 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">新建模板</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>名称</label>
              <input className={inputCls} value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="压测模板名" />
            </div>
            <div>
              <label className={labelCls}>描述</label>
              <input className={inputCls} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="可选" />
            </div>
          </div>

          <BotConfigForm config={botConfig} onChange={setBotConfig} />

          {/* Phases Editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">阶段列表</h3>
              <PhasePresetBar onApply={(p) => setPhases(p)} />
            </div>
            {phases.map((p, i) => (
              <PhaseCard key={i} phase={p} index={i} onChange={updatePhase} onRemove={removePhase} />
            ))}
            <button onClick={addPhase} className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-500 dark:hover:text-blue-400">
              + 添加阶段
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={handleCreate} className="px-5 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700">创建模板</button>
            <button onClick={resetForm} className="px-5 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-600">取消</button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <p className="text-sm text-gray-400 dark:text-gray-500">加载中…</p>}

      {/* Template List */}
      <div className="space-y-3">
        {templates.map((t) => (
          <div key={t.id} className="bg-white dark:bg-gray-800/50 shadow-sm dark:shadow-none rounded-lg p-4 flex items-center justify-between border border-gray-200 dark:border-gray-700">
            <div>
              <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{t.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t.description || '无描述'}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">创建于 {new Date(t.createdAt).toLocaleString()}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleCreateSession(t.id)} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700">从模板创建会话</button>
              <button onClick={() => handleDelete(t.id)} className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700">删除</button>
            </div>
          </div>
        ))}
        {!loading && templates.length === 0 && (
          <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">暂无模板</p>
        )}
      </div>
    </div>
  );
}
