import { useState } from 'react';
import { serverApi } from '../../api/server.api.js';
import { useServerStore } from '../../stores/server.store.js';

interface MinecraftQuickActionsProps {
  resourceId: string;
  serverRunning: boolean;
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

export function MinecraftQuickActions({ resourceId, serverRunning }: MinecraftQuickActionsProps) {
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

  const handleStart = async () => {
    await executeAction('start', () => serverApi.startServer(resourceId));
    useServerStore.getState().fetchServers();
  };
  const handleStop = async () => {
    await executeAction('stop', () => serverApi.stopServer(resourceId));
    useServerStore.getState().fetchServers();
  };
  const handleRestart = async () => {
    await executeAction('restart', () => serverApi.restartServer(resourceId));
    useServerStore.getState().fetchServers();
  };
  const handlePing = () => executeAction('ping', () => serverApi.pingServer(resourceId));
  const handleCreateBackup = () => executeAction('backup', () =>
    serverApi.createBackup(resourceId, { type: 'full', note: `manual-${Date.now()}` })
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
        {/* Server control actions */}
        {!serverRunning ? (
          <ActionButton
            label="启动服务器"
            description="启动 Minecraft 服务器"
            onClick={handleStart}
            variant="primary"
            loading={loadingAction === 'start'}
          />
        ) : (
          <ActionButton
            label="停止服务器"
            description="安全停止服务器"
            onClick={handleStop}
            variant="danger"
            loading={loadingAction === 'stop'}
          />
        )}

        <ActionButton
          label="重启服务器"
          description="重启 Minecraft 服务器"
          onClick={handleRestart}
          disabled={!serverRunning}
          loading={loadingAction === 'restart'}
        />

        {/* Utility actions */}
        <ActionButton
          label="Ping 测试"
          description="检查服务器响应"
          onClick={handlePing}
          loading={loadingAction === 'ping'}
        />

        <ActionButton
          label="创建备份"
          description="手动创建服务器备份"
          onClick={handleCreateBackup}
          loading={loadingAction === 'backup'}
        />
      </div>
    </div>
  );
}