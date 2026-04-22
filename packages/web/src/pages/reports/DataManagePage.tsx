import { type FC, useState, useEffect, useCallback } from 'react';
import { reportApi } from '../../api/report.api.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import type { ArchiveStatsDto, ArchiveResultDto } from '@jian-agent/shared-domain';

const DataManagePage: FC = () => {
  const [stats, setStats] = useState<ArchiveStatsDto | null>(null);
  const [retentionDays, setRetentionDays] = useState(30);
  const [archiving, setArchiving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    reportApi.getArchiveStats().then((s) => {
      setStats(s);
      setRetentionDays(s.retentionDays);
    });
  }, []);

  const handleArchive = useCallback(async () => {
    const confirmed = await useDialogStore.getState().confirm({ title: '执行归档', message: '确认立即执行归档？过期数据将被导出并删除。', variant: 'danger', confirmLabel: '执行归档' });
    if (!confirmed) return;
    setArchiving(true);
    setMessage(null);
    try {
      const result: ArchiveResultDto = await reportApi.triggerArchive();
      setMessage(`归档完成: 导出 ${result.exportedSessions} 个会话, 截止日期 ${result.cutoffDate}`);
      // Refresh stats
      const s = await reportApi.getArchiveStats();
      setStats(s);
    } catch (err: any) {
      setMessage(`归档失败: ${err.message}`);
    } finally {
      setArchiving(false);
    }
  }, []);

  const handleSaveRetention = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      await reportApi.updateRetention(retentionDays);
      setMessage(`保留策略已更新为 ${retentionDays} 天`);
    } catch (err: any) {
      setMessage(`保存失败: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, [retentionDays]);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold text-zinc-100">数据管理</h1>

      {message && (
        <div className="bg-blue-900/20 border border-blue-700 rounded px-4 py-3 text-sm text-zinc-200">
          {message}
        </div>
      )}

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="总记录数" value={String(stats.totalSessions)} />
          <StatCard
            label="最早数据"
            value={stats.oldestDataDate ? new Date(stats.oldestDataDate).toLocaleDateString('zh-CN') : '无'}
          />
          <StatCard label="归档大小" value={`${stats.archiveDirSizeMb} MB`} />
          <StatCard label="保留天数" value={`${stats.retentionDays}天`} />
        </div>
      )}

      {/* Retention config */}
      <div className="bg-zinc-800 rounded-lg p-4">
        <h2 className="text-sm font-medium text-zinc-300 mb-3">数据保留策略</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm text-zinc-400">保留天数:</label>
          <input
            type="number"
            min={1}
            max={365}
            value={retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value))}
            className="w-24 px-3 py-1.5 rounded bg-zinc-700 border border-zinc-600 text-zinc-100 text-sm"
          />
          <button
            onClick={handleSaveRetention}
            disabled={saving}
            className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          超过保留天数的数据将在归档时被导出为 JSON 并从数据库删除
        </p>
      </div>

      {/* Manual archive */}
      <div className="bg-zinc-800 rounded-lg p-4">
        <h2 className="text-sm font-medium text-zinc-300 mb-3">手动归档</h2>
        <p className="text-sm text-zinc-400 mb-3">
          立即执行归档操作。系统也会每天凌晨 3:00 自动归档。
        </p>
        <button
          onClick={handleArchive}
          disabled={archiving}
          className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm"
        >
          {archiving ? '归档中...' : '立即归档'}
        </button>
      </div>
    </div>
  );
};

const StatCard: FC<{ readonly label: string; readonly value: string }> = ({ label, value }) => (
  <div className="bg-zinc-800 rounded-lg p-4 text-center">
    <div className="text-2xl font-bold text-zinc-100">{value}</div>
    <div className="text-xs text-zinc-400 mt-1">{label}</div>
  </div>
);

export default DataManagePage;
