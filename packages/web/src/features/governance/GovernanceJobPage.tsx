import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GovernanceActionDto } from '@jian-agent/shared-domain';
import { governanceApi, type GovernanceJobDto } from '../../api/governance.api.js';

function RiskBadge({ level }: { level: GovernanceActionDto['riskLevel'] }) {
  const config: Record<string, { label: string; className: string }> = {
    low: { label: '低', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    medium: { label: '中', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
    high: { label: '高', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
    critical: { label: '严重', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  };
  const { label, className } = config[level] ?? config.medium;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function ActionStatusBadge({ status }: { status: GovernanceActionDto['status'] }) {
  const config: Record<GovernanceActionDto['status'], { label: string; className: string }> = {
    pending: { label: '待审批', className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
    approved: { label: '已批准', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    rejected: { label: '已拒绝', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
    executed: { label: '已执行', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    failed: { label: '执行失败', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  };
  const { label, className } = config[status];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function ActionTypeLabel({ type }: { type: GovernanceActionDto['type'] }) {
  const labels: Record<string, string> = {
    rollback: '回滚',
    'scale-down': '缩容',
    quarantine: '隔离',
    notify: '通知',
    block: '阻断',
    custom: '自定义',
  };
  return <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{labels[type] ?? type}</span>;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function GovernanceJobPage() {
  const [jobs, setJobs] = useState<GovernanceJobDto[]>([]);
  const [actions, setActions] = useState<GovernanceActionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [acting, setActing] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, actionsRes] = await Promise.all([
        governanceApi.listJobs({ limit: 50 }),
        governanceApi.listActions({ status: statusFilter || undefined, limit: 50 }),
      ]);
      setJobs(jobsRes.data ?? []);
      setActions(actionsRes.data ?? []);
    } catch (err: any) {
      // If the governance API is not yet available, show a friendly message
      if (err.status === 404 || err.status === 501) {
        setJobs([]);
        setActions([]);
      } else {
        setError(err.message ?? '加载治理数据失败');
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAction = async (
    actionId: string,
    fn: (id: string) => Promise<unknown>,
  ) => {
    setActing(actionId);
    try {
      await fn(actionId);
      await loadData();
    } catch (err: any) {
      setError(err.message ?? '操作失败');
    } finally {
      setActing(null);
    }
  };

  const pendingActions = actions.filter((a) => a.status === 'pending');
  const recentActions = actions.filter((a) => a.status !== 'pending');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">治理中心</h1>
        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-2 py-1 text-sm dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="">全部状态</option>
            <option value="pending">待审批</option>
            <option value="approved">已批准</option>
            <option value="executed">已执行</option>
            <option value="rejected">已拒绝</option>
            <option value="failed">执行失败</option>
          </select>
          <button
            onClick={loadData}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mr-2"></div>
          加载中...
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">待审批</div>
              <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{pendingActions.length}</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">治理任务</div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{jobs.length}</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">已执行</div>
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {actions.filter((a) => a.status === 'executed').length}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">执行失败</div>
              <div className="text-lg font-bold text-red-600 dark:text-red-400">
                {actions.filter((a) => a.status === 'failed').length}
              </div>
            </div>
          </div>

          {/* Pending actions - require approval */}
          {pendingActions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                待审批操作 ({pendingActions.length})
              </h2>
              <div className="space-y-2">
                {pendingActions.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <RiskBadge level={action.riskLevel} />
                      <ActionTypeLabel type={action.type} />
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        触发于 {formatTime(action.createdAt)}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-3">
                      <button
                        onClick={() => handleAction(action.id, governanceApi.approveAction)}
                        disabled={acting === action.id}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        {acting === action.id ? '处理中...' : '批准'}
                      </button>
                      <button
                        onClick={() => handleAction(action.id, governanceApi.rejectAction)}
                        disabled={acting === action.id}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent actions history */}
          {recentActions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                操作历史
              </h2>
              <div className="overflow-hidden rounded-2xl border border-white/55 dark:border-primary-300/20 backdrop-blur-xl bg-white/80 dark:bg-slate-900/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/40 dark:bg-slate-800/40 border-b border-white/40 dark:border-primary-300/10 text-xs text-gray-600 dark:text-gray-300">
                      <th className="text-left px-4 py-2 font-semibold">时间</th>
                      <th className="text-left px-4 py-2 font-semibold">类型</th>
                      <th className="text-left px-4 py-2 font-semibold">风险</th>
                      <th className="text-left px-4 py-2 font-semibold">状态</th>
                      <th className="text-left px-4 py-2 font-semibold">审批人</th>
                      <th className="text-left px-4 py-2 font-semibold">触发会话</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/30 dark:divide-primary-300/10">
                    {recentActions.map((action, idx) => (
                      <tr
                        key={action.id}
                        className={`transition-colors ${idx % 2 === 0 ? 'hover:bg-white/50 dark:hover:bg-slate-800/50' : 'bg-white/20 dark:bg-slate-800/10 hover:bg-white/60 dark:hover:bg-slate-800/60'}`}
                      >
                        <td className="px-4 py-2 whitespace-nowrap">{formatTime(action.createdAt)}</td>
                        <td className="px-4 py-2"><ActionTypeLabel type={action.type} /></td>
                        <td className="px-4 py-2"><RiskBadge level={action.riskLevel} /></td>
                        <td className="px-4 py-2"><ActionStatusBadge status={action.status} /></td>
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{action.approvedBy ?? '-'}</td>
                        <td className="px-4 py-2">
                          {action.triggerRunId ? (
                            <button
                              onClick={() => navigate(`/sessions/${action.triggerRunId}`)}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              查看
                            </button>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Jobs list */}
          {jobs.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                治理任务 ({jobs.length})
              </h2>
              <div className="space-y-2">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {job.type} — {job.summary ?? job.id}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        job.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                        job.status === 'running' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                        job.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {job.actions.length} 个操作 |
                      资源: {job.targetResourceIds.join(', ')} |
                      创建于 {formatTime(job.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {pendingActions.length === 0 && recentActions.length === 0 && jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm space-y-2">
              <p>暂无治理数据</p>
              <p className="text-xs">当验证计划触发治理策略时，相关操作将在此显示</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
