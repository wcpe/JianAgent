import { useState, useEffect, useCallback } from 'react';
import { serverApi } from '../../api/server.api.js';
import type { BackupDto, BackupScheduleDto, BackupType, UpdateBackupScheduleRequest } from '@jian-agent/shared-domain';
import { Download, Trash2, Plus, Clock, RefreshCw, Archive, Settings } from 'lucide-react';
import { ErrorAlert } from '../../components/ui/ErrorAlert.js';

interface BackupTabProps {
  readonly serverId: string;
}

const BACKUP_TYPE_LABELS: Record<BackupType, string> = {
  full: '完整备份',
  world: '地图备份',
  config: '配置备份',
  plugins: '插件备份',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-warning-100 text-warning-700 dark:bg-warning-700/40 dark:text-warning-400',
  running: 'bg-info-100 text-info-700 dark:bg-info-700/40 dark:text-info-400',
  completed: 'bg-success-100 text-success-700 dark:bg-success-700/40 dark:text-success-400',
  failed: 'bg-danger-100 text-danger-700 dark:bg-danger-700/40 dark:text-danger-400',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '等待中',
  running: '备份中',
  completed: '已完成',
  failed: '失败',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

export function BackupTab({ serverId }: BackupTabProps) {
  const [backups, setBackups] = useState<readonly BackupDto[]>([]);
  const [schedule, setSchedule] = useState<BackupScheduleDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [createType, setCreateType] = useState<BackupType>('full');
  const [createNote, setCreateNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, sched] = await Promise.all([
        serverApi.listBackups(serverId),
        serverApi.getBackupSchedule(serverId),
      ]);
      setBackups(list);
      setSchedule(sched);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      await serverApi.createBackup(serverId, {
        type: createType,
        note: createNote || undefined,
      });
      setCreateNote('');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '创建备份失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (backupId: string) => {
    if (!window.confirm('确认删除此备份？')) return;
    try {
      await serverApi.deleteBackup(serverId, backupId);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleDownload = async (backupId: string, _fileName: string) => {
    try {
      const res = await serverApi.downloadBackup(serverId, backupId);
      const bytes = Uint8Array.from(atob(res.data), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '下载失败');
    }
  };

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Archive className="w-5 h-5" />
          服务器备份
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300 transition-colors"
          >
            <Settings className="w-4 h-4" />
            定时备份
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} />}

      {/* Schedule Panel */}
      {showSchedule && schedule && (
        <SchedulePanel
          schedule={schedule}
          serverId={serverId}
          onUpdate={(s) => setSchedule(s)}
          onError={(e) => setError(e)}
        />
      )}

      {/* Create Backup */}
      <div className="flex items-end gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">备份类型</label>
          <select
            value={createType}
            onChange={(e) => setCreateType(e.target.value as BackupType)}
            className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
          >
            {Object.entries(BACKUP_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex-[2]">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">备注（可选）</label>
          <input
            type="text"
            value={createNote}
            onChange={(e) => setCreateNote(e.target.value)}
            placeholder="例：更新前备份"
            className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {creating ? '创建中...' : '创建备份'}
        </button>
      </div>

      {/* Backup List */}
      {loading && backups.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">加载中...</div>
      ) : backups.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">
          暂无备份记录
        </div>
      ) : (
        <div className="rounded-2xl border border-white/55 dark:border-primary-300/20 backdrop-blur-xl bg-white/80 dark:bg-gray-900/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/40 dark:bg-gray-800/40 border-b border-white/40 dark:border-primary-300/10">
                <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-semibold whitespace-nowrap">文件名</th>
                <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-semibold whitespace-nowrap">类型</th>
                <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-semibold whitespace-nowrap">状态</th>
                <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-semibold whitespace-nowrap">大小</th>
                <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-semibold whitespace-nowrap">备注</th>
                <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-semibold whitespace-nowrap">创建时间</th>
                <th className="text-right px-4 py-2 text-gray-600 dark:text-gray-300 font-semibold whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/30 dark:divide-primary-300/10">
              {backups.map((b) => (
                <tr key={b.id} className={`transition-colors ${
                  backups.indexOf(b) % 2 === 0
                    ? 'hover:bg-white/50 dark:hover:bg-gray-800/50'
                    : 'bg-white/20 dark:bg-gray-800/10 hover:bg-white/60 dark:hover:bg-gray-800/60'
                }`}>
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100 font-mono text-xs max-w-[200px] truncate" title={b.fileName}>
                    {b.fileName}
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    {BACKUP_TYPE_LABELS[b.type] ?? b.type}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[b.status] ?? ''}`}>
                      {STATUS_LABELS[b.status] ?? b.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {b.status === 'completed' ? formatBytes(b.sizeBytes) : '-'}
                  </td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400 max-w-[150px] truncate" title={b.note}>
                    {b.note || '-'}
                  </td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatDate(b.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {b.status === 'completed' && (
                        <button
                          onClick={() => handleDownload(b.id, b.fileName)}
                          className="p-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                          title="下载"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="p-1 text-danger-600 hover:text-danger-700 dark:text-danger-400 dark:hover:text-danger-200 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
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

// --- Schedule Sub-panel ---

interface SchedulePanelProps {
  readonly schedule: BackupScheduleDto;
  readonly serverId: string;
  readonly onUpdate: (s: BackupScheduleDto) => void;
  readonly onError: (msg: string) => void;
}

function SchedulePanel({ schedule, serverId, onUpdate, onError }: SchedulePanelProps) {
  const [enabled, setEnabled] = useState(schedule.enabled);
  const [cron, setCron] = useState(schedule.cronExpression);
  const [type, setType] = useState<BackupType>(schedule.type);
  const [maxKeep, setMaxKeep] = useState(schedule.maxKeep);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await serverApi.updateBackupSchedule(serverId, {
        enabled,
        cronExpression: cron,
        type,
        maxKeep,
      });
      onUpdate(updated);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          定时备份设置
        </h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded"
          />
          <span className="text-gray-700 dark:text-gray-300">启用</span>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Cron 表达式</label>
          <input
            type="text"
            value={cron}
            onChange={(e) => setCron(e.target.value)}
            placeholder="0 3 * * *"
            className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 font-mono"
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">默认每日凌晨3点</p>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">备份类型</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as BackupType)}
            className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
          >
            {Object.entries(BACKUP_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">最大保留数</label>
          <input
            type="number"
            value={maxKeep}
            onChange={(e) => setMaxKeep(Number(e.target.value))}
            min={1}
            max={100}
            className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存设置'}
        </button>
      </div>
    </div>
  );
}
