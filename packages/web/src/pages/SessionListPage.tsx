import { useEffect, useCallback, useState } from 'react';
import { useSessionStore } from '../stores/session.store.js';
import { sessionApi } from '../api/session.api.js';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';

const STATE_COLORS: Record<string, string> = {
  CREATED: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  RUNNING: 'bg-green-200 text-green-800 dark:bg-green-900/40 dark:text-green-400',
  PAUSED: 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400',
  FINISHED: 'bg-blue-200 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400',
  ERROR: 'bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-400',
};

export function SessionListPage() {
  const { sessions, setSessions, setLoading, loading } = useSessionStore();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await sessionApi.list();
      setSessions(res.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setSessions]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">压测会话</h1>
        <button
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          onClick={() => navigate('/sessions/new')}
        >
          新建会话
        </button>
      </div>
      {loading && <p className="text-gray-500 dark:text-gray-400">加载中…</p>}
      {error && <ErrorState message={error} onRetry={fetchSessions} />}
      {!loading && !error && sessions.length === 0 && (
        <EmptyState
          title="还没有压测会话"
          description="创建一个会话开始测试"
          action={{ label: '创建会话', onClick: () => navigate('/sessions/new') }}
        />
      )}
      {!loading && !error && sessions.length > 0 && (
      <div className="overflow-x-auto rounded-2xl border border-white/55 dark:border-primary-300/20 backdrop-blur-xl bg-white/80 dark:bg-slate-900/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/40 dark:bg-slate-800/40 border-b border-white/40 dark:border-primary-300/10 text-left text-xs text-gray-600 dark:text-gray-300 uppercase font-semibold">
            <th className="px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">名称</th>
            <th className="px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">状态</th>
            <th className="px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">当前阶段</th>
            <th className="px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">创建时间</th>
            <th className="px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/30 dark:divide-primary-300/10">
          {sessions.map((s, idx) => (
            <tr
              key={s.id}
              className={`transition-colors ${idx % 2 === 0 ? 'hover:bg-white/50 dark:hover:bg-slate-800/50' : 'bg-white/20 dark:bg-slate-800/10 hover:bg-white/60 dark:hover:bg-slate-800/60'}`}
            >
              <td className="px-4 py-2">
                <button className="text-primary-600 dark:text-primary-400 hover:underline transition-colors" onClick={() => navigate(`/sessions/${s.id}`)}>
                  {s.name}
                </button>
              </td>
              <td className="px-4 py-2">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATE_COLORS[s.state] ?? 'bg-gray-100 dark:bg-gray-700'}`}>
                  {s.state}
                </span>
              </td>
              <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{s.currentPhase ?? '-'}</td>
              <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{s.createdAt ?? '-'}</td>
              <td className="px-4 py-2">
                {s.state === 'CREATED' && (
                  <button
                    className="text-primary-600 dark:text-primary-400 hover:underline text-xs transition-colors"
                    onClick={() => sessionApi.start(s.id).then(fetchSessions)}
                  >
                    启动
                  </button>
                )}
                {s.state === 'RUNNING' && (
                  <button
                    className="text-red-600 dark:text-red-400 hover:underline text-xs transition-colors"
                    onClick={() => sessionApi.stop(s.id).then(fetchSessions)}
                  >
                    停止
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      )}
    </div>
  );
}
