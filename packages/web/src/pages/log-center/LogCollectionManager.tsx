import { useEffect, useState, useCallback } from 'react';
import { logCollectionApi } from '../../api/log-center.api.js';
import { remoteHostApi } from '../../api/remote-host.api.js';
import { EmptyState } from '../../components/EmptyState.js';
import { ErrorState } from '../../components/ErrorState.js';
import { StyledSelect } from '../../components/ui/StyledSelect.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import type { LogCollectionConfigDto, RemoteHostDto } from '@jian-agent/shared-domain';

const LOG_FORMATS = [
  { value: 'mc', label: 'Minecraft' },
  { value: 'syslog', label: 'Syslog' },
  { value: 'json', label: 'JSON' },
  { value: 'plain', label: 'Plain Text' },
] as const;

export function LogCollectionManager() {
  const [configs, setConfigs] = useState<readonly LogCollectionConfigDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [hosts, setHosts] = useState<readonly RemoteHostDto[]>([]);

  // Form state
  const [formHostId, setFormHostId] = useState('');
  const [formHostType, setFormHostType] = useState<'local' | 'remote'>('local');
  const [formFilePath, setFormFilePath] = useState('');
  const [formLogFormat, setFormLogFormat] = useState<string>('mc');
  const [formPollInterval, setFormPollInterval] = useState('30');
  const [submitting, setSubmitting] = useState(false);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await logCollectionApi.list();
      setConfigs(data);
    } catch (err: any) {
      setError(err.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHosts = useCallback(async () => {
    try {
      const h = await remoteHostApi.list();
      setHosts(h);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
    fetchHosts();
  }, [fetchConfigs, fetchHosts]);

  const resetForm = () => {
    setFormHostId('');
    setFormHostType('local');
    setFormFilePath('');
    setFormLogFormat('mc');
    setFormPollInterval('30');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formHostId.trim() || !formFilePath.trim()) return;
    setSubmitting(true);
    try {
      await logCollectionApi.create({
        hostId: formHostId.trim(),
        hostType: formHostType,
        filePath: formFilePath.trim(),
        logFormat: formLogFormat as 'mc' | 'syslog' | 'json' | 'plain',
        pollIntervalSec: parseInt(formPollInterval, 10) || 30,
      });
      useDialogStore.getState().showToast('采集配置已创建', 'success');
      resetForm();
      setShowForm(false);
      fetchConfigs();
    } catch (err: any) {
      useDialogStore.getState().showToast(err.message ?? '创建失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (config: LogCollectionConfigDto) => {
    try {
      await logCollectionApi.toggleEnabled(config.id, !config.enabled);
      setConfigs((prev) => prev.map((c) => (c.id === config.id ? { ...c, enabled: !c.enabled } : c)));
      useDialogStore.getState().showToast(config.enabled ? '已禁用' : '已启用', 'success');
    } catch (err: any) {
      useDialogStore.getState().showToast(err.message ?? '操作失败', 'error');
    }
  };

  const handleDelete = async (config: LogCollectionConfigDto) => {
    const ok = await useDialogStore.getState().confirm({
      title: '删除采集配置',
      message: `确定删除此采集配置？文件路径: ${config.filePath}`,
      variant: 'danger',
      confirmLabel: '删除',
    });
    if (!ok) return;
    try {
      await logCollectionApi.delete(config.id);
      setConfigs((prev) => prev.filter((c) => c.id !== config.id));
      useDialogStore.getState().showToast('已删除', 'success');
    } catch (err: any) {
      useDialogStore.getState().showToast(err.message ?? '删除失败', 'error');
    }
  };

  const formatLabel = (fmt: string) => {
    return LOG_FORMATS.find((f) => f.value === fmt)?.label ?? fmt;
  };

  const hostName = (hostId: string) => {
    return hosts.find((h) => h.id === hostId)?.name ?? hostId;
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">日志采集配置</h1>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg p-3">
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 active:scale-95 transition-all duration-150"
        >
          {showForm ? '取消' : '新建配置'}
        </button>
        <button
          onClick={fetchConfigs}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 active:scale-95 transition-all duration-150"
        >
          刷新
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-2xl border border-white/55 dark:border-primary-300/20 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg p-4 space-y-4"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">新建采集配置</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">主机类型</label>
              <StyledSelect
                value={formHostType}
                onChange={(e) => setFormHostType(e.target.value as 'local' | 'remote')}
                className="w-full"
              >
                <option value="local">本地</option>
                <option value="remote">远程</option>
              </StyledSelect>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">目标主机 *</label>
              <StyledSelect
                value={formHostId}
                onChange={(e) => setFormHostId(e.target.value)}
                className="w-full"
                required
              >
                <option value="">请选择主机</option>
                {hosts.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </StyledSelect>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">文件路径 *</label>
              <input
                value={formFilePath}
                onChange={(e) => setFormFilePath(e.target.value)}
                placeholder="例：/opt/mc-server/logs/latest.log"
                required
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">日志格式</label>
              <StyledSelect
                value={formLogFormat}
                onChange={(e) => setFormLogFormat(e.target.value)}
                className="w-full"
              >
                {LOG_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </StyledSelect>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">轮询间隔 (秒)</label>
              <input
                type="number"
                min={5}
                value={formPollInterval}
                onChange={(e) => setFormPollInterval(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition-all duration-150"
            >
              {submitting ? '创建中...' : '创建配置'}
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
        <ErrorState message={error} onRetry={fetchConfigs} />
      ) : configs.length === 0 ? (
        <EmptyState
          title="还没有采集配置"
          description="添加配置以开始采集远程或本地日志"
          action={{ label: '新建配置', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/55 dark:border-primary-300/20 backdrop-blur-xl bg-white/80 dark:bg-slate-900/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/40 dark:border-primary-300/10 bg-white/40 dark:bg-slate-800/40 text-left text-xs text-gray-600 dark:text-gray-300 uppercase whitespace-nowrap font-semibold">
                <th className="px-4 py-3">主机</th>
                <th className="px-4 py-3">类型</th>
                <th className="px-4 py-3">文件路径</th>
                <th className="px-4 py-3">格式</th>
                <th className="px-4 py-3">轮询间隔</th>
                <th className="px-4 py-3">上次采集</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/30 dark:divide-primary-300/10">
              {configs.map((config) => (
                <tr
                  key={config.id}
                  className={`transition-colors ${
                    config.id.charCodeAt(0) % 2 === 0
                      ? 'hover:bg-white/50 dark:hover:bg-slate-800/50'
                      : 'bg-white/20 dark:bg-slate-800/10 hover:bg-white/60 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{hostName(config.hostId)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {config.hostType === 'local' ? '本地' : '远程'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 max-w-[200px] truncate">{config.filePath}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatLabel(config.logFormat)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{config.pollIntervalSec}s</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {config.lastCollectedAt ? new Date(config.lastCollectedAt).toLocaleString() : '从未'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      config.enabled
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {config.enabled ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggle(config)}
                        className="text-primary-600 dark:text-primary-400 hover:underline text-xs"
                      >
                        {config.enabled ? '禁用' : '启用'}
                      </button>
                      <button
                        onClick={() => handleDelete(config)}
                        className="text-red-600 dark:text-red-400 hover:underline text-xs"
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
