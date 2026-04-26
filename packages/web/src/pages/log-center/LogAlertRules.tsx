import { useEffect, useState, useCallback } from 'react';
import { logAlertRuleApi } from '../../api/log-center.api.js';
import { notificationApi } from '../../api/notification.api.js';
import { remoteHostApi } from '../../api/remote-host.api.js';
import { EmptyState } from '../../components/EmptyState.js';
import { ErrorState } from '../../components/ErrorState.js';
import { StyledSelect } from '../../components/ui/StyledSelect.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import type { LogAlertRuleDto, NotificationChannelDto, RemoteHostDto } from '@jian-agent/shared-domain';

export function LogAlertRules() {
  const [rules, setRules] = useState<readonly LogAlertRuleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [hosts, setHosts] = useState<readonly RemoteHostDto[]>([]);
  const [channels, setChannels] = useState<readonly NotificationChannelDto[]>([]);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPattern, setFormPattern] = useState('');
  const [formLevel, setFormLevel] = useState('ERROR');
  const [formHostId, setFormHostId] = useState('');
  const [formCooldown, setFormCooldown] = useState('300');
  const [formChannelId, setFormChannelId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await logAlertRuleApi.list();
      setRules(data);
    } catch (err: any) {
      setError(err.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuxData = useCallback(async () => {
    try {
      const [h, c] = await Promise.all([
        remoteHostApi.list().catch(() => []),
        notificationApi.listChannels().catch(() => []),
      ]);
      setHosts(h);
      setChannels(c);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchRules();
    fetchAuxData();
  }, [fetchRules, fetchAuxData]);

  const resetForm = () => {
    setFormName('');
    setFormPattern('');
    setFormLevel('ERROR');
    setFormHostId('');
    setFormCooldown('300');
    setFormChannelId('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPattern.trim()) return;
    setSubmitting(true);
    try {
      await logAlertRuleApi.create({
        name: formName.trim(),
        pattern: formPattern.trim(),
        level: formLevel,
        hostId: formHostId || undefined,
        cooldownSec: parseInt(formCooldown, 10) || 300,
        notificationChannelId: formChannelId || undefined,
      });
      useDialogStore.getState().showToast('规则已创建', 'success');
      resetForm();
      setShowForm(false);
      fetchRules();
    } catch (err: any) {
      useDialogStore.getState().showToast(err.message ?? '创建失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (rule: LogAlertRuleDto) => {
    try {
      await logAlertRuleApi.toggleEnabled(rule.id, !rule.enabled);
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)));
      useDialogStore.getState().showToast(rule.enabled ? '已禁用' : '已启用', 'success');
    } catch (err: any) {
      useDialogStore.getState().showToast(err.message ?? '操作失败', 'error');
    }
  };

  const handleDelete = async (rule: LogAlertRuleDto) => {
    const ok = await useDialogStore.getState().confirm({
      title: '删除告警规则',
      message: `确定删除规则 "${rule.name}"？此操作不可恢复。`,
      variant: 'danger',
      confirmLabel: '删除',
    });
    if (!ok) return;
    try {
      await logAlertRuleApi.delete(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      useDialogStore.getState().showToast('已删除', 'success');
    } catch (err: any) {
      useDialogStore.getState().showToast(err.message ?? '删除失败', 'error');
    }
  };

  const levelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR': return 'bg-danger-100 text-danger-700 dark:bg-danger-700/30 dark:text-danger-400';
      case 'WARN': return 'bg-warning-100 text-warning-700 dark:bg-warning-700/30 dark:text-warning-400';
      case 'INFO': return 'bg-info-100 text-info-700 dark:bg-info-700/30 dark:text-info-400';
      default: return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">日志告警规则</h1>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/75 dark:bg-gray-900/60 backdrop-blur-xl shadow-lg p-3">
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 active:scale-95 transition-all duration-150"
        >
          {showForm ? '取消' : '新建规则'}
        </button>
        <button
          onClick={fetchRules}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 active:scale-95 transition-all duration-150"
        >
          刷新
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl shadow-lg p-4 space-y-4"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">新建告警规则</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">规则名称 *</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例：OOM 异常检测"
                required
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">匹配正则 *</label>
              <input
                value={formPattern}
                onChange={(e) => setFormPattern(e.target.value)}
                placeholder="例：OutOfMemoryError|OOM"
                required
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">日志级别</label>
              <StyledSelect
                value={formLevel}
                onChange={(e) => setFormLevel(e.target.value)}
                className="w-full"
              >
                <option value="ERROR">ERROR</option>
                <option value="WARN">WARN</option>
                <option value="INFO">INFO</option>
              </StyledSelect>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">目标主机</label>
              <StyledSelect
                value={formHostId}
                onChange={(e) => setFormHostId(e.target.value)}
                className="w-full"
              >
                <option value="">全部主机</option>
                {hosts.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </StyledSelect>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">冷却时间 (秒)</label>
              <input
                type="number"
                min={0}
                value={formCooldown}
                onChange={(e) => setFormCooldown(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">通知渠道</label>
              <StyledSelect
                value={formChannelId}
                onChange={(e) => setFormChannelId(e.target.value)}
                className="w-full"
              >
                <option value="">不通知</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </StyledSelect>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition-all duration-150"
            >
              {submitting ? '创建中...' : '创建规则'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); resetForm(); }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              取消
            </button>
          </div>
        </form>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12 text-gray-400">加载中...</div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchRules} />
      ) : rules.length === 0 ? (
        <EmptyState
          title="还没有告警规则"
          description="创建规则以便在日志匹配时收到通知"
          action={{ label: '新建规则', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/55 dark:border-primary-300/20 backdrop-blur-xl bg-white/80 dark:bg-gray-900/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/40 dark:border-primary-300/10 bg-white/40 dark:bg-gray-800/40 text-left text-xs text-gray-600 dark:text-gray-300 uppercase whitespace-nowrap font-semibold">
                <th className="px-4 py-3">名称</th>
                <th className="px-4 py-3">匹配模式</th>
                <th className="px-4 py-3">级别</th>
                <th className="px-4 py-3">目标主机</th>
                <th className="px-4 py-3">冷却(秒)</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/30 dark:divide-primary-300/10">
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className={`transition-colors ${
                    rule.id.charCodeAt(0) % 2 === 0
                      ? 'hover:bg-white/50 dark:hover:bg-gray-800/50'
                      : 'bg-white/20 dark:bg-gray-800/10 hover:bg-white/60 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{rule.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 max-w-[200px] truncate">{rule.pattern}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${levelColor(rule.level)}`}>
                      {rule.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {rule.hostId ? (hosts.find((h) => h.id === rule.hostId)?.name ?? rule.hostId) : '全部'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{rule.cooldownSec}s</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      rule.enabled
                        ? 'bg-success-100 text-success-700 dark:bg-success-700/30 dark:text-success-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {rule.enabled ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggle(rule)}
                        className="text-primary-600 dark:text-primary-400 hover:underline text-xs"
                      >
                        {rule.enabled ? '禁用' : '启用'}
                      </button>
                      <button
                        onClick={() => handleDelete(rule)}
                        className="text-danger-600 dark:text-danger-400 hover:underline text-xs"
                      >
                        删除
                      </button>
                    </div>
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
