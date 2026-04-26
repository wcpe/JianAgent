import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionApi, type SessionSummaryUI } from '../api/session.api.js';
import { PhaseTimeline } from '../components/PhaseTimeline.js';

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionSummaryUI | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await sessionApi.getOne(id);
    setSession(res.data);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!session) return <p className="p-4 text-gray-500 dark:text-gray-400">加载中…</p>;

  const handleStart = async () => {
    await sessionApi.start(session.id);
    load();
  };

  const handleStop = async () => {
    await sessionApi.stop(session.id);
    load();
  };

  return (
    <div className="p-4 max-w-3xl">
      <button onClick={() => navigate('/sessions')} className="text-blue-500 dark:text-blue-400 hover:underline text-sm mb-4">
        ← 返回列表
      </button>

      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">{session.name}</h1>

      <div className="space-y-2 text-sm mb-6">
        <div className="text-gray-700 dark:text-gray-300"><span className="text-gray-500 dark:text-gray-400">状态：</span>{session.state}</div>
        <div className="text-gray-700 dark:text-gray-300"><span className="text-gray-500 dark:text-gray-400">当前阶段：</span>{session.currentPhase ?? '-'}</div>
        <div className="text-gray-700 dark:text-gray-300"><span className="text-gray-500 dark:text-gray-400">创建时间：</span>{session.createdAt ?? '-'}</div>
      </div>

      <div className="flex gap-2 mb-6">
        {session.state === 'CREATED' && (
          <button onClick={handleStart} className="px-3 py-1 bg-success-500 text-white rounded text-sm hover:bg-success-600">
            启动
          </button>
        )}
        {session.state === 'RUNNING' && (
          <button onClick={handleStop} className="px-3 py-1 bg-danger-500 text-white rounded text-sm hover:bg-danger-600">
            停止
          </button>
        )}
      </div>

      <PhaseTimeline phases={[]} currentPhase={session.currentPhase ?? null} />
    </div>
  );
}
