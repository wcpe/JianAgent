import { useFileTaskStore } from '../../../features/file-tasks/index.js';

interface FileListToolbarProps {
  readonly currentPath: string;
  readonly breadcrumbs: string[];
  readonly uploading: boolean;
  readonly showNewDir: boolean;
  readonly newDirName: string;
  readonly onGoUp: () => void;
  readonly onNavigate: (path: string) => void;
  readonly onRefresh: () => void;
  readonly onUploadClick: () => void;
  readonly onToggleNewDir: () => void;
  readonly onNewDirNameChange: (name: string) => void;
  readonly onCreateDir: () => void;
  readonly onCancelNewDir: () => void;
}

export function FileListToolbar({
  currentPath,
  breadcrumbs,
  uploading,
  showNewDir,
  newDirName,
  onGoUp,
  onNavigate,
  onRefresh,
  onUploadClick,
  onToggleNewDir,
  onNewDirNameChange,
  onCreateDir,
  onCancelNewDir,
}: FileListToolbarProps) {
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={onGoUp}
          disabled={currentPath === '/'}
          className="px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30"
        >
          &larr; 上级
        </button>
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 min-w-0 overflow-hidden">
          <button onClick={() => onNavigate('/')} className="hover:text-blue-500 shrink-0">/</button>
          {breadcrumbs.map((seg, i) => {
            const path = '/' + breadcrumbs.slice(0, i + 1).join('/');
            return (
              <span key={path} className="shrink-0">
                {i > 0 && <span className="mx-0.5">/</span>}
                <button onClick={() => onNavigate(path)} className="hover:text-blue-500">{seg}</button>
              </span>
            );
          })}
        </div>
        <div className="flex-1" />
        <button
          onClick={onUploadClick}
          disabled={uploading}
          className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 dark:hover:bg-gray-700 rounded disabled:opacity-50"
        >
          {uploading ? '提交中...' : '上传文件'}
        </button>
        <button
          onClick={onToggleNewDir}
          className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded"
        >
          新建文件夹
        </button>
        <button
          onClick={onRefresh}
          className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
        >
          刷新
        </button>
        <button
          onClick={() => useFileTaskStore.getState().togglePanel()}
          className="px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 dark:hover:bg-gray-700 rounded flex items-center gap-1"
        >
          任务
        </button>
      </div>

      {showNewDir && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <input
            value={newDirName}
            onChange={(e) => onNewDirNameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onCreateDir(); }}
            placeholder="文件夹名称"
            className="flex-1 border rounded px-2 py-1 text-xs dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            autoFocus
          />
          <button onClick={onCreateDir} className="px-2 py-1 text-xs bg-blue-600 text-white rounded">创建</button>
          <button onClick={onCancelNewDir} className="px-2 py-1 text-xs text-gray-500">取消</button>
        </div>
      )}
    </>
  );
}
