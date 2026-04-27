import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Info, Clock, User, Code, Zap, ChevronDown, ChevronUp, Settings, Power, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { JvmProcessDetail } from '../../../types/jvm.types';
import { jvmApi } from '../../../api/jvm.api';
import { formatBytes, formatUptime } from '../../../utils/format.js';
import { useDialogStore } from '../../../stores/dialog.store.js';
import { useAuthStore } from '../../../stores/auth.store.js';
import { RoleLevel } from '@jian-agent/shared-domain';
import { ProbeActionsModal } from '../../../components/ProbeActionsModal';
import { ShutdownConfirmDialog } from '../../../components/ShutdownConfirmDialog';

interface JvmProcessCardProps {
  process: JvmProcessDetail;
  onRefresh?: () => void;
}

const JvmProcessCard: React.FC<JvmProcessCardProps> = React.memo(({ process: initialProcess, onRefresh }) => {
  const [process, setProcess] = useState(initialProcess);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);
  const [shutdownLoading, setShutdownLoading] = useState(false);
  const showToast = useDialogStore((state) => state.showToast);
  const userRole = useAuthStore((state) => state.user?.role ?? 0);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  
  const isAdmin = userRole >= RoleLevel.ADMIN;

  // Update local state when prop changes
  useEffect(() => {
    setProcess(initialProcess);
  }, [initialProcess]);

  // Auto-refresh when attached
  useEffect(() => {
    if (process.memory) {
      // Start auto-refresh timer (every 5 seconds)
      refreshTimerRef.current = setInterval(() => {
        onRefresh?.();
      }, 5000);
    } else {
      // Clear timer when not attached
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [process.memory, onRefresh]);

  const handleAttach = async () => {
    setLoading(true);
    try {
      await jvmApi.attachToProcess(process.pid);
      showToast(`已附加到 PID ${process.pid}`, 'success');
      onRefresh?.();
      // Auto-open modal after successful attach
      setModalOpen(true);
    } catch (error: any) {
      showToast(error?.message ?? '探针附加失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleProbeActions = () => {
    if (process.memory) {
      // Already attached, open modal directly
      setModalOpen(true);
    } else {
      // Not attached, attach first
      handleAttach();
    }
  };

  const handleDetach = async () => {
    setLoading(true);
    try {
      await jvmApi.detachFromProcess();
      showToast('探针已卸载', 'success');
      // Clear local metrics
      setProcess({ ...process, memory: undefined, thread: undefined, gc: undefined });
      onRefresh?.();
    } catch (error: any) {
      showToast(error?.message ?? '探针卸载失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleShutdown = async (graceful: boolean, timeout: number) => {
    setShutdownLoading(true);
    try {
      await jvmApi.shutdownJvm(String(process.pid), graceful, timeout);
      showToast(
        `进程 ${process.pid} 已${graceful ? '优雅' : '强制'}关闭`,
        'success'
      );
      // Wait a bit before refreshing to allow process to terminate
      setTimeout(() => {
        onRefresh?.();
      }, 1000);
    } catch (error: any) {
      showToast(error?.message ?? '关闭应用失败', 'error');
      throw error;
    } finally {
      setShutdownLoading(false);
    }
  };

  const handleMonitoring = () => {
    navigate(`/jvm/${process.pid}/monitoring`);
  };

  const heapUsagePercent = process.memory
    ? Math.round((process.memory.heapUsed / process.memory.heapMax) * 100)
    : 0;

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow mb-4 border border-gray-200 dark:border-gray-700">
        {/* Card Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
          <Code className="w-5 h-5 text-blue-500" />
          <span className="font-semibold text-gray-900 dark:text-white">
            {process.name || process.mainClass}
          </span>
          <span className={`px-2 py-1 text-xs rounded ${
            process.memory
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
          }`}>
            PID: {process.pid}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {process.memory && (
            <span className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded" title="探针已附加">
              <Zap className="w-3 h-3" />
              探针已附加
            </span>
          )}
          <button
            onClick={handleProbeActions}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Settings className="w-4 h-4" />
            {loading ? '处理中...' : process.memory ? '探针操作' : '附加探针'}
          </button>
          {process.memory && (
            <button
              onClick={handleDetach}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Square className="w-4 h-4" />
              {loading ? '处理中...' : '卸载探针'}
            </button>
          )}
          <button
            onClick={handleMonitoring}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
            title="打开实时监控页面"
          >
            <Activity className="w-4 h-4" />
            实时监控
          </button>
          {isAdmin && (
            <button
              onClick={() => setShutdownDialogOpen(true)}
              disabled={loading || shutdownLoading}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="关闭应用（仅管理员）"
            >
              <Power className="w-4 h-4" />
              {shutdownLoading ? '关闭中...' : '关闭应用'}
            </button>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4">
        {/* Basic Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="flex items-center gap-1 text-gray-500 text-sm mb-1">
              <User className="w-4 h-4" />
              用户
            </div>
            <div className="font-medium text-gray-900 dark:text-white">{process.user || '-'}</div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-gray-500 text-sm mb-1">
              <Clock className="w-4 h-4" />
              运行时间
            </div>
            <div className="font-medium text-gray-900 dark:text-white">{formatUptime(process.uptime)}</div>
          </div>
          <div>
            <div className="text-gray-500 text-sm mb-1">Java 版本</div>
            <div className="font-medium text-gray-900 dark:text-white">{process.javaVersion || '-'}</div>
          </div>
          <div>
            <div className="text-gray-500 text-sm mb-1">JVM 版本</div>
            <div className="font-medium text-sm text-gray-900 dark:text-white">{process.jvmVersion || '-'}</div>
          </div>
        </div>

        {/* Memory & Performance */}
        {process.memory && (
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">堆内存使用</div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-1">
                  <div
                    className={`h-4 rounded-full transition-all ${
                      heapUsagePercent > 90
                        ? 'bg-red-500'
                        : heapUsagePercent > 70
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${heapUsagePercent}%` }}
                  />
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {formatBytes(process.memory.heapUsed)} / {formatBytes(process.memory.heapMax)} ({heapUsagePercent}%)
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">非堆内存</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {formatBytes(process.memory.nonHeapUsed)} / {formatBytes(process.memory.nonHeapMax || process.memory.nonHeapCommitted)}
                </div>
              </div>
            </div>

            {process.thread && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">线程总数</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">{process.thread.threadCount}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">峰值线程</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">{process.thread.peakThreadCount}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">守护线程</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">{process.thread.daemonThreadCount}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">已启动线程</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">{process.thread.totalStartedThreadCount}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* GC Info */}
        {process.gc && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Young GC</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {process.gc.youngGcCount}次 / {process.gc.youngGcTime}ms
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Old GC</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {process.gc.oldGcCount}次 / {process.gc.oldGcTime}ms
              </div>
            </div>
          </div>
        )}

        {/* CPU Usage */}
        {process.cpuUsage !== undefined && (
          <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded mb-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">CPU 使用率</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {process.cpuUsage.toFixed(1)}%
            </div>
          </div>
        )}

        {/* Expanded Details */}
        {expanded && (
          <div className="border border-gray-200 dark:border-gray-700 rounded divide-y divide-gray-200 dark:divide-gray-700">
            <div className="p-3">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">主类</div>
              <div className="text-gray-900 dark:text-white font-mono text-sm">{process.mainClass || '-'}</div>
            </div>
            <div className="p-3">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">启动时间</div>
              <div className="text-gray-900 dark:text-white">{process.startTime || '-'}</div>
            </div>
            <div className="p-3">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">命令行</div>
              <div className="max-h-20 overflow-y-auto text-xs font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded text-gray-900 dark:text-white">
                {process.commandLine}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

      <ProbeActionsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        pid={process.pid}
        processName={process.name || process.mainClass || 'Java Process'}
        heapSample={process.memory ? { data: { heapUsage: process.memory } } : undefined}
        threadSample={process.thread ? { data: { threadCount: process.thread.threadCount } } : undefined}
      />

      <ShutdownConfirmDialog
        open={shutdownDialogOpen}
        onClose={() => setShutdownDialogOpen(false)}
        process={process}
        onConfirm={handleShutdown}
      />
    </>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数：只在 process 的关键属性变化时才重新渲染
  return (
    prevProps.process.pid === nextProps.process.pid &&
    prevProps.process.name === nextProps.process.name &&
    prevProps.process.mainClass === nextProps.process.mainClass &&
    prevProps.process.user === nextProps.process.user &&
    prevProps.process.uptime === nextProps.process.uptime &&
    prevProps.process.startTime === nextProps.process.startTime &&
    prevProps.process.commandLine === nextProps.process.commandLine &&
    // 比较内存、线程、GC 数据
    JSON.stringify(prevProps.process.memory) === JSON.stringify(nextProps.process.memory) &&
    JSON.stringify(prevProps.process.thread) === JSON.stringify(nextProps.process.thread) &&
    JSON.stringify(prevProps.process.gc) === JSON.stringify(nextProps.process.gc)
  );
});

export default JvmProcessCard;
