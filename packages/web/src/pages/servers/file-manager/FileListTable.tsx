import type { FileEntry } from '../../../api/server.api.js';
import { isTextFile, formatSize } from './file-utils.js';

interface FileListTableProps {
  readonly entries: readonly FileEntry[];
  readonly loading: boolean;
  readonly renamingEntry: string | null;
  readonly renameValue: string;
  readonly onEntryClick: (entry: FileEntry) => void;
  readonly onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  readonly onRenameValueChange: (value: string) => void;
  readonly onConfirmRename: () => void;
  readonly onCancelRename: () => void;
  readonly onDownload: (name: string) => void;
  readonly onStartRename: (name: string) => void;
  readonly onDelete: (name: string) => void;
}

export function FileListTable({
  entries,
  loading,
  renamingEntry,
  renameValue,
  onEntryClick,
  onContextMenu,
  onRenameValueChange,
  onConfirmRename,
  onCancelRename,
  onDownload,
  onStartRename,
  onDelete,
}: FileListTableProps) {
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-gray-400 text-sm">加载中...</div>;
  }

  if (entries.length === 0) {
    return <div className="flex items-center justify-center h-32 text-gray-400 text-sm">空目录</div>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
          <th className="text-left px-4 py-2 font-medium">名称</th>
          <th className="text-right px-4 py-2 font-medium w-24">大小</th>
          <th className="text-right px-4 py-2 font-medium w-40">修改时间</th>
          <th className="text-right px-4 py-2 font-medium w-32">操作</th>
        </tr>
      </thead>
      <tbody>
        {sortedEntries.map((entry) => (
          <tr
            key={entry.name}
            className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            onContextMenu={(e) => onContextMenu(e, entry)}
          >
            <td className="px-4 py-2">
              {renamingEntry === entry.name ? (
                <input
                  value={renameValue}
                  onChange={(e) => onRenameValueChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onConfirmRename();
                    if (e.key === 'Escape') onCancelRename();
                  }}
                  onBlur={onConfirmRename}
                  className="w-full border rounded px-1 py-0.5 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => onEntryClick(entry)}
                  className={`text-left ${
                    entry.isDirectory
                      ? 'text-blue-600 dark:text-blue-400'
                      : isTextFile(entry.name)
                        ? 'text-gray-700 dark:text-gray-200 hover:text-blue-600'
                        : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  <span className="mr-2">{entry.isDirectory ? '\uD83D\uDCC1' : '\uD83D\uDCC4'}</span>
                  {entry.name}
                </button>
              )}
            </td>
            <td className="px-4 py-2 text-right text-xs text-gray-400">
              {entry.isDirectory ? '-' : formatSize(entry.size)}
            </td>
            <td className="px-4 py-2 text-right text-xs text-gray-400">
              {entry.modifiedAt ? new Date(entry.modifiedAt).toLocaleString('zh-CN') : '-'}
            </td>
            <td className="px-4 py-2 text-right space-x-1">
              {!entry.isDirectory && (
                <button
                  onClick={() => onDownload(entry.name)}
                  className="text-xs text-blue-500 hover:text-blue-700"
                >
                  下载
                </button>
              )}
              <button
                onClick={() => onStartRename(entry.name)}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                重命名
              </button>
              <button
                onClick={() => onDelete(entry.name)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                删除
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
