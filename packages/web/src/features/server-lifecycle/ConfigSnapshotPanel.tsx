import { useState, useEffect, useCallback } from 'react';
import { serverApi } from '../../api/server.api.js';
import { History, RotateCcw, Clock, User, AlertTriangle } from 'lucide-react';

interface ConfigSnapshot {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
}

interface ConfigSnapshotPanelProps {
  readonly serverId: string;
}

export function ConfigSnapshotPanel({ serverId }: ConfigSnapshotPanelProps) {
  const [snapshots, setSnapshots] = useState<ConfigSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await serverApi.listSnapshots(serverId);
      setSnapshots(data);
    } catch (err: any) {
      setError(err.message ?? '加载快照失败');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  const handleRestore = async (snapId: string) => {
    setRestoringId(snapId);
    setShowConfirm(null);
    try {
      await serverApi.restoreSnapshot(serverId, snapId);
      // Reload snapshots after restore
      await loadSnapshots();
    } catch (err: any) {
      setError(err.message ?? '恢复配置失败');
    } finally {
      setRestoringId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        加载快照中...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <History className="w-5 h-5" />
          配置快照
        </h3>
        <button
          onClick={loadSnapshots}
          className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
        >
          刷新
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      )}

      <p className="text-sm text-gray-500 dark:text-gray-400">
        每次配置更新时会自动创建快照。点击“恢复”可将配置回滚到对应版本。
      </p>

      {snapshots.length === 0 ? (
        <div className="p-8 text-center text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>暂无配置快照</p>
          <p className="text-xs mt-1">配置更新后将自动创建快照</p>
        </div>
      ) : (
        <div className="space-y-2">
          {snapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {snapshot.name}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(snapshot.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {snapshot.createdBy}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {showConfirm === snapshot.id ? (
                    <>
                      <button
                        onClick={() => handleRestore(snapshot.id)}
                        disabled={restoringId === snapshot.id}
                        className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-50"
                      >
                        {restoringId === snapshot.id ? '恢复中...' : '确认恢复'}
                      </button>
                      <button
                        onClick={() => setShowConfirm(null)}
                        className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setShowConfirm(snapshot.id)}
                      disabled={restoringId !== null}
                      className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                      <RotateCcw className="w-3 h-3" />
                      恢复
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
