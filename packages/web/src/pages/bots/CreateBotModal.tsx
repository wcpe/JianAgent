import { useState } from 'react';
import { useBotStore } from '../../stores/bot.store.js';
import { botApi } from '../../api/bot.api.js';
import { StyledSelect } from '../../components/ui/StyledSelect.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import { Modal } from '../../components/ui/Modal.js';
import { ErrorAlert } from '../../components/ui/ErrorAlert.js';

const ALL_BEHAVIORS = [
  { id: 'idle', label: '静止' },
  { id: 'walk_random', label: '随机行走' },
  { id: 'chat_spam', label: '聊天刷屏' },
  { id: 'pvp_attack', label: 'PVP 攻击' },
  { id: 'gather', label: '挖矿收集' },
  { id: 'jump', label: '跳跃' },
  { id: 'look', label: '环顾' },
  { id: 'move_to', label: '寻路移动' },
  { id: 'interact', label: '交互方块' },
  { id: 'attack', label: '攻击实体' },
] as const;

interface CreateBotModalProps {
  readonly serverId: string;
  readonly open: boolean;
  readonly onClose: () => void;
}

export function CreateBotModal({ serverId, open, onClose }: CreateBotModalProps) {
  const createBatch = useBotStore((s) => s.createBatch);
  const [namePrefix, setNamePrefix] = useState('bot');
  const [count, setCount] = useState(10);
  const [behavior, setBehavior] = useState('idle');
  const [rejoinStrategy, setRejoinStrategy] = useState('always');
  const [maxRetries, setMaxRetries] = useState(5);
  const [autoRespawn, setAutoRespawn] = useState(true);
  const [saveConfig, setSaveConfig] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showToast = useDialogStore((s) => s.showToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createBatch({ serverId, namePrefix, count, behavior, autoRespawn });
      if (saveConfig) {
        await botApi.createSavedConfig({ serverId, namePrefix, count, behavior, autoCreate: true, rejoinStrategy, maxRetries });
      }
      showToast(`成功创建 ${count} 个机器人`, 'success');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <div className="flex gap-3">
      <button
        type="submit"
        form="create-bot-form"
        disabled={submitting}
        className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded px-4 py-2 text-sm"
      >
        {submitting ? '创建中...' : '创建'}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 text-sm text-gray-300 hover:text-gray-100 border border-gray-600 rounded"
      >
        取消
      </button>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="创建机器人批次" size="md" footer={footer}>
      <form id="create-bot-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-300 mb-1">名称前缀</label>
          <input
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200"
            value={namePrefix}
            onChange={(e) => setNamePrefix(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">数量</label>
          <input
            type="number"
            min={1}
            max={500}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">行为模板</label>
          <StyledSelect
            className="w-full"
            value={behavior}
            onChange={(e) => setBehavior(e.target.value)}
          >
            {ALL_BEHAVIORS.map((b) => (
              <option key={b.id} value={b.id}>{b.id} — {b.label}</option>
            ))}
          </StyledSelect>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">重连策略</label>
          <StyledSelect
            className="w-full"
            value={rejoinStrategy}
            onChange={(e) => setRejoinStrategy(e.target.value)}
          >
            <option value="always">always — 始终重连</option>
            <option value="retry">retry — 重试N次后待机</option>
            <option value="manual">manual — 手动重连</option>
          </StyledSelect>
        </div>

        {rejoinStrategy === 'retry' && (
          <div>
            <label className="block text-sm text-gray-300 mb-1">最大重试次数</label>
            <input
              type="number"
              min={1}
              max={100}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200"
              value={maxRetries}
              onChange={(e) => setMaxRetries(parseInt(e.target.value, 10) || 5)}
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="autoRespawn"
            checked={autoRespawn}
            onChange={(e) => setAutoRespawn(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          <label htmlFor="autoRespawn" className="text-sm text-gray-300">死亡后自动复活</label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="saveConfig"
            checked={saveConfig}
            onChange={(e) => setSaveConfig(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          <label htmlFor="saveConfig" className="text-sm text-gray-300">保存配置（下次自动创建）</label>
        </div>

        {error && <ErrorAlert message={error} />}
      </form>
    </Modal>
  );
}
