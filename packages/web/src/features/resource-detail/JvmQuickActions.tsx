import { useState } from 'react';
import { javaHelperApi } from '../../api/java-helper.api.js';

interface JvmQuickActionsProps {
  resourceId: string;
  helperAttached: boolean;
  pid?: string;
}

interface ActionButtonProps {
  label: string;
  description: string;
  onClick: () => Promise<void>;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}

function ActionButton({ label, description, onClick, disabled, variant = 'secondary', loading }: ActionButtonProps) {
  const baseClasses = 'flex flex-col items-start p-3 rounded-lg border transition-colors';
  const variantClasses = {
    primary: 'border-blue-300 bg-blue-50 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-900/30',
    secondary: 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700',
    danger: 'border-red-300 bg-red-50 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/20 dark:hover:bg-red-900/30',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-2">
        {loading && (
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
        )}
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</span>
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</span>
    </button>
  );
}

export function JvmQuickActions({ resourceId, helperAttached, pid }: JvmQuickActionsProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const executeAction = async (actionName: string, action: () => Promise<any>) => {
    setLoadingAction(actionName);
    setResult(null);
    try {
      const response = await action();
      setResult({
        success: response.success ?? true,
        message: response.message ?? `${actionName} 执行成功`,
      });
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message ?? `${actionName} 执行失败`,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAttach = () => executeAction('attach', () => javaHelperApi.attach(resourceId));
  const handleDetach = () => executeAction('detach', () => javaHelperApi.detach());
  const handleThreadSample = () => executeAction('thread-sample', () => javaHelperApi.sample('thread'));
  const handleHeapSample = () => executeAction('heap-sample', () => javaHelperApi.sample('heap'));
  const handleStartJfr = () => executeAction('start-jfr', () =>
    javaHelperApi.startJfr({ serverId: resourceId, pid: pid ?? '0', durationSec: 60, settings: 'default' })
  );
  const handleStopJfr = () => executeAction('stop-jfr', () =>
    javaHelperApi.stopJfr('latest') // In real implementation, this would need a task ID
  );

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">快速操作</h4>

      {/* Result message */}
      {result && (
        <div className={`mb-3 p-2 rounded text-xs ${
          result.success
            ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
            : 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400'
        }`}>
          {result.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {/* Connection actions */}
        {!helperAttached ? (
          <ActionButton
            label="连接 Helper"
            description="附加到 JVM 进程"
            onClick={handleAttach}
            variant="primary"
            loading={loadingAction === 'attach'}
          />
        ) : (
          <ActionButton
            label="断开 Helper"
            description="分离 JVM 进程"
            onClick={handleDetach}
            variant="danger"
            loading={loadingAction === 'detach'}
          />
        )}

        {/* Sampling actions */}
        <ActionButton
          label="线程采样"
          description="获取线程快照"
          onClick={handleThreadSample}
          disabled={!helperAttached}
          loading={loadingAction === 'thread-sample'}
        />
        <ActionButton
          label="堆采样"
          description="获取堆内存快照"
          onClick={handleHeapSample}
          disabled={!helperAttached}
          loading={loadingAction === 'heap-sample'}
        />

        {/* JFR actions */}
        <ActionButton
          label="开始 JFR"
            description="录制 60 秒飞行记录"
          onClick={handleStartJfr}
          disabled={!helperAttached}
          loading={loadingAction === 'start-jfr'}
        />
        <ActionButton
          label="停止 JFR"
          description="停止当前录制"
          onClick={handleStopJfr}
          disabled={!helperAttached}
          loading={loadingAction === 'stop-jfr'}
        />
      </div>
    </div>
  );
}