import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionApi } from '../api/session.api.js';
import { useServerStore } from '../stores/server.store.js';
import { StyledSelect } from '../components/ui/StyledSelect.js';

interface PhaseInput {
  phase: string;
  botCount: number;
  behavior: string;
  durationSec: number;
}

export function SessionCreatePage() {
  const navigate = useNavigate();
  const servers = useServerStore((s) => s.servers);
  const fetchServers = useServerStore((s) => s.fetchServers);
  const runningServers = servers.filter((s) => s.runtimeStatus === 'running');
  const [name, setName] = useState('');
  const [serverId, setServerId] = useState('');
  const [botConfigId, setBotConfigId] = useState('');
  const [phases, setPhases] = useState<PhaseInput[]>([
    { phase: 'ramp-up', botCount: 10, behavior: 'idle', durationSec: 60 },
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchServers(); }, [fetchServers]);

  const addPhase = () => {
    setPhases([...phases, { phase: '', botCount: 10, behavior: 'idle', durationSec: 60 }]);
  };

  const updatePhase = (i: number, field: keyof PhaseInput, value: string | number) => {
    setPhases(phases.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  };

  const removePhase = (i: number) => {
    setPhases(phases.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await sessionApi.create({ name, serverId, botConfigId, phases });
      navigate('/sessions');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">新建压测会话</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">会话名称</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 w-full text-sm" required />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">目标服务器</label>
          <StyledSelect value={serverId} onChange={(e) => setServerId(e.target.value)} className="w-full">
            <option value="">选择服务器</option>
            {runningServers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </StyledSelect>
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Bot 配置 ID</label>
          <input value={botConfigId} onChange={(e) => setBotConfigId(e.target.value)} className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 w-full text-sm" required />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-600 dark:text-gray-400 font-medium">阶段配置</label>
            <button type="button" onClick={addPhase} className="text-blue-500 text-sm hover:underline">+ 添加阶段</button>
          </div>
          {phases.map((p, i) => (
            <div key={i} className="flex gap-2 mb-2 items-center">
              <input placeholder="阶段名" value={p.phase} onChange={(e) => updatePhase(i, 'phase', e.target.value)} className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-2 py-1 text-sm flex-1" />
              <input type="number" placeholder="Bot数" value={p.botCount} onChange={(e) => updatePhase(i, 'botCount', Number(e.target.value))} className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-2 py-1 text-sm w-20" />
              <StyledSelect variant="compact" value={p.behavior} onChange={(e) => updatePhase(i, 'behavior', e.target.value)}>
                <option value="idle">idle</option>
                <option value="move-random">move-random</option>
                <option value="chat">chat</option>
                <option value="gather">gather</option>
              </StyledSelect>
              <input type="number" placeholder="持续(秒)" value={p.durationSec} onChange={(e) => updatePhase(i, 'durationSec', Number(e.target.value))} className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-2 py-1 text-sm w-24" />
              <button type="button" onClick={() => removePhase(i)} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {submitting ? '创建中…' : '创建会话'}
        </button>
      </form>
    </div>
  );
}
