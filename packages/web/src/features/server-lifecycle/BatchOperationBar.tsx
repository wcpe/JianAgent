interface BatchOperationBarProps {
  readonly selectedCount: number;
  readonly onStart: () => void;
  readonly onStop: () => void;
  readonly onRestart: () => void;
  readonly onDelete: () => void;
  readonly onClear: () => void;
  readonly loading?: boolean;
}

export function BatchOperationBar({ selectedCount, onStart, onStop, onRestart, onDelete, onClear, loading }: BatchOperationBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl px-4 py-3 flex items-center gap-3">
      <span className="text-sm text-gray-700 dark:text-gray-300">已选择 <strong>{selectedCount}</strong> 个服务器</span>
      <div className="flex gap-2">
        <button onClick={onStart} disabled={loading} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">启动选中</button>
        <button onClick={onStop} disabled={loading} className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">停止选中</button>
        <button onClick={onRestart} disabled={loading} className="px-3 py-1.5 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50">重启选中</button>
        <button onClick={onDelete} disabled={loading} className="px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50">删除选中</button>
      </div>
      <button onClick={onClear} className="text-xs text-gray-500 hover:text-gray-700 ml-2">清除选择</button>
    </div>
  );
}
