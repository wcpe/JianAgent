import React, { useState } from 'react';
import { AlertTriangle, Power } from 'lucide-react';
import { Modal } from './ui/Modal';
import type { JvmProcessDetail } from '../types/jvm.types';
import { formatUptime } from '../utils/format';

interface ShutdownConfirmDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly process: JvmProcessDetail;
  readonly onConfirm: (graceful: boolean, timeout: number) => Promise<void>;
}

export function ShutdownConfirmDialog({ open, onClose, process, onConfirm }: ShutdownConfirmDialogProps) {
  const [graceful, setGraceful] = useState(true);
  const [timeout, setTimeout] = useState(30);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(graceful, timeout);
      onClose();
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <div className="flex justify-end gap-3">
      <button
        onClick={onClose}
        disabled={loading}
        className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        取消
      </button>
      <button
        onClick={handleConfirm}
        disabled={loading}
        className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 border border-red-500 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <Power className="w-4 h-4" />
        {loading ? '关闭中...' : '确认关闭'}
      </button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="关闭应用确认"
      subtitle="此操作将终止 JVM 进程"
      size="md"
      footer={footer}
    >
      <div className="space-y-4">
        {/* Warning Alert */}
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
              危险操作警告
            </h4>
            <p className="text-sm text-red-700 dark:text-red-300">
              关闭应用将终止 JVM 进程，可能导致数据丢失或服务中断。请确认您了解此操作的影响。
            </p>
          </div>
        </div>

        {/* Process Info */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            进程信息
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">进程 ID：</span>
              <span className="font-medium text-gray-900 dark:text-gray-100 ml-2">
                {process.pid}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">进程名称：</span>
              <span className="font-medium text-gray-900 dark:text-gray-100 ml-2">
                {process.name || process.mainClass || '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">运行时间：</span>
              <span className="font-medium text-gray-900 dark:text-gray-100 ml-2">
                {formatUptime(process.uptime)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">用户：</span>
              <span className="font-medium text-gray-900 dark:text-gray-100 ml-2">
                {process.user || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Shutdown Options */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            关闭方式
          </h4>
          
          <div className="space-y-2">
            <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <input
                type="radio"
                name="shutdownType"
                checked={graceful}
                onChange={() => setGraceful(true)}
                className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  优雅关闭（推荐）
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  通过 JVM 钩子正常关闭，允许应用清理资源和保存状态
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <input
                type="radio"
                name="shutdownType"
                checked={!graceful}
                onChange={() => setGraceful(false)}
                className="mt-0.5 w-4 h-4 text-red-600 focus:ring-red-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  强制关闭
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  立即终止进程，可能导致数据丢失或状态不一致
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Timeout Setting */}
        {graceful && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              超时时间（秒）
            </label>
            <input
              type="number"
              min={5}
              max={300}
              value={timeout}
              onChange={(e) => setTimeout(Math.max(5, Math.min(300, parseInt(e.target.value) || 30)))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              如果应用在指定时间内未能正常关闭，将强制终止进程（5-300 秒）
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
