/**
 * FileTaskPanel — File task queue panel
 *
 * Displays a list of file tasks with progress, status, and actions.
 * Designed to be embedded in FileManagerTab or shown as a slide-out panel.
 */

import { useMemo } from 'react';
import { useFileTaskStore, type FileTaskItem } from './file-task.store.js';
import { useFileTasks } from './use-file-tasks.js';

const KIND_LABELS: Record<string, string> = {
  UPLOAD: '上传',
  PACK_DOWNLOAD: '打包下载',
  DIR_COPY: '目录复制',
  DIR_MOVE: '目录移动',
  COMPRESS: '压缩',
  DECOMPRESS: '解压',
  REMOTE_DOWNLOAD: '远程下载',
};

const STATE_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  RUNNING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

function TaskKindIcon({ kind }: { readonly kind: string }) {
  const icons: Record<string, string> = {
    UPLOAD: '⬆',
    PACK_DOWNLOAD: '⬇',
    DIR_COPY: '📋',
    DIR_MOVE: '📦',
    COMPRESS: '🗜',
    DECOMPRESS: '📂',
    REMOTE_DOWNLOAD: '🌐',
  };
  return <span className="text-sm">{icons[kind] ?? '📄'}</span>;
}

function ProgressBar({ progress, state }: { readonly progress: number; readonly state: string }) {
  const pct = Math.min(100, Math.max(0, progress));
  const colorClass =
    state === 'COMPLETED'
      ? 'bg-green-500'
      : state === 'FAILED'
        ? 'bg-red-500'
        : state === 'CANCELLED'
          ? 'bg-gray-400'
          : 'bg-blue-500';

  return (
    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function TaskRow({
  task,
  onCancel,
  onDownload,
}: {
  readonly task: FileTaskItem;
  readonly onCancel: (taskId: string) => void;
  readonly onDownload: (taskId: string) => void;
}) {
  const kindLabel = KIND_LABELS[task.kind] ?? task.kind;
  const isActive = task.state === 'PENDING' || task.state === 'RUNNING';
  const canDownload = task.state === 'COMPLETED' && task.resultArtifact;

  return (
    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="flex items-center gap-2">
        <TaskKindIcon kind={task.kind} />
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200 flex-1 truncate">
          {kindLabel}
          {task.sourcePaths.length > 0 && (
            <span className="font-normal text-gray-400 dark:text-gray-500 ml-1">
              {task.sourcePaths.length === 1
                ? task.sourcePaths[0].split('/').pop()
                : `${task.sourcePaths.length} 个文件`}
            </span>
          )}
        </span>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${STATE_COLORS[task.state]}`}
        >
          {task.state}
        </span>
      </div>

      {/* Progress bar for active tasks */}
      {isActive && (
        <div className="mt-1.5">
          <ProgressBar progress={task.progress} state={task.state} />
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[10px] text-gray-400 truncate flex-1">{task.message}</span>
            <span className="text-[10px] text-gray-400 ml-2">{task.progress}%</span>
          </div>
        </div>
      )}

      {/* Error message */}
      {task.state === 'FAILED' && task.error && (
        <div className="mt-1 text-[10px] text-red-500 dark:text-red-400 truncate">{task.error}</div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 mt-1">
        {isActive && (
          <button
            onClick={() => onCancel(task.taskId)}
            className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
          >
            取消
          </button>
        )}
        {canDownload && (
          <button
            onClick={() => onDownload(task.taskId)}
            className="text-[10px] text-blue-500 hover:text-blue-700 transition-colors"
          >
            下载结果
          </button>
        )}
      </div>
    </div>
  );
}

export interface FileTaskPanelProps {
  readonly serverId: string;
  /** Compact mode — no border/background, just the task list */
  readonly compact?: boolean;
}

export function FileTaskPanel({ serverId, compact = false }: FileTaskPanelProps) {
  const panelVisible = useFileTaskStore((s) => s.panelVisible);
  const togglePanel = useFileTaskStore((s) => s.togglePanel);

  const { tasks, activeCount, cancelTask, downloadArtifact, clearCompleted } =
    useFileTasks(serverId);

  const hasTasks = tasks.length > 0;

  // Only render panel content when visible or in compact mode
  const showContent = compact || panelVisible;

  // Header badge
  const badge = useMemo(() => {
    if (activeCount === 0) return null;
    return (
      <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-blue-500 text-white text-[10px] font-medium">
        {activeCount}
      </span>
    );
  }, [activeCount]);

  if (!compact) {
    // Collapsible panel mode
    return (
      <div className="border-t border-gray-200 dark:border-gray-700">
        {/* Toggle bar */}
        <button
          onClick={togglePanel}
          className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <span className="transform transition-transform" style={{ transform: panelVisible ? 'rotate(90deg)' : '' }}>
            ▶
          </span>
          <span>任务队列</span>
          {badge}
          {hasTasks && !panelVisible && (
            <span className="text-gray-400 ml-auto">{tasks.length} 个任务</span>
          )}
          {hasTasks && (
            <span
              onClick={(e) => { e.stopPropagation(); clearCompleted(); }}
              className="ml-auto text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              清除已完成
            </span>
          )}
        </button>

        {/* Task list */}
        {panelVisible && (
          <div className="max-h-48 overflow-y-auto bg-gray-50/50 dark:bg-gray-900/50">
            {!hasTasks ? (
              <div className="px-4 py-3 text-xs text-gray-400 text-center">暂无任务</div>
            ) : (
              tasks.map((task) => (
                <TaskRow
                  key={task.taskId}
                  task={task}
                  onCancel={cancelTask}
                  onDownload={downloadArtifact}
                />
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // Compact mode — just the list, no wrapper
  return (
    <div>
      {!hasTasks ? (
        <div className="text-xs text-gray-400 py-1">暂无任务</div>
      ) : (
        tasks.map((task) => (
          <TaskRow
            key={task.taskId}
            task={task}
            onCancel={cancelTask}
            onDownload={downloadArtifact}
          />
        ))
      )}
    </div>
  );
}
