import { useEffect, useState, useCallback } from 'react';
import { botApi } from '../api/bot.api.js';
import { BotStateTag } from '../components/BotStateTag.js';
import { StyledSelect } from '../components/ui/StyledSelect.js';

interface Props {
  readonly name: string;
  readonly onClose: () => void;
}

interface BotDetail {
  readonly name: string;
  readonly state: string;
  readonly currentBehavior: string;
}

export function BotDetailPanel({ name, onClose }: Props) {
  const [detail, setDetail] = useState<BotDetail | null>(null);
  const [behavior, setBehavior] = useState('idle');

  const load = useCallback(async () => {
    const res = await botApi.getOne(name);
    setDetail(res.data);
  }, [name]);

  useEffect(() => { load(); }, [load]);

  const handleSetBehavior = async () => {
    await botApi.setBehavior(name, behavior);
    load();
  };

  const handleStop = async () => {
    await botApi.stop(name);
    onClose();
  };

  if (!detail) return <p className="text-gray-500">加载中…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold font-mono text-gray-900 dark:text-gray-100">{detail.name}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
      </div>

      <div className="space-y-3 text-sm">
        <div><span className="text-gray-500 dark:text-gray-400">状态：</span><BotStateTag state={detail.state} /></div>
        <div><span className="text-gray-500 dark:text-gray-400">当前行为：</span>{detail.currentBehavior ?? '无'}</div>

        <hr className="dark:border-gray-700" />

        <div>
          <label className="block text-gray-500 dark:text-gray-400 mb-1">切换行为：</label>
          <div className="flex gap-2">
            <StyledSelect
              value={behavior}
              onChange={(e) => setBehavior(e.target.value)}
              className="flex-1"
            >
              <option value="idle">idle</option>
              <option value="move-random">move-random</option>
              <option value="chat">chat</option>
              <option value="gather">gather</option>
            </StyledSelect>
            <button
              onClick={handleSetBehavior}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              应用
            </button>
          </div>
        </div>

        <button
          onClick={handleStop}
          className="w-full mt-4 px-3 py-2 bg-danger-500 text-white rounded text-sm hover:bg-danger-600"
        >
          停止此 Bot
        </button>
      </div>
    </div>
  );
}
