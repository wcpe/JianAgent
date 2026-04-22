import { useState, useEffect, useCallback, useRef } from 'react';
import { serverApi, type FileEntry } from '../../api/server.api.js';
import { ApiError } from '../../api/client.js';
import { CodeEditor } from './CodeEditor.js';
import { FileVersionPanel } from './FileVersionPanel.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import { FileTaskPanel, useFileTaskStore } from '../../features/file-tasks/index.js';

interface FileManagerTabProps {
  readonly serverId: string;
}

const TEXT_EXTENSIONS = new Set([
  '.yml', '.yaml', '.properties', '.json', '.txt', '.cfg', '.conf',
  '.toml', '.log', '.md', '.xml', '.sh', '.bat', '.cmd', '.csv', '.ini',
]);

function isTextFile(name: string): boolean {
  const ext = name.lastIndexOf('.') >= 0 ? name.slice(name.lastIndexOf('.')) : '';
  return TEXT_EXTENSIONS.has(ext.toLowerCase());
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildPath(currentPath: string, name: string): string {
  return currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
}

// ── Context Menu ──

interface ContextMenuState {
  readonly x: number;
  readonly y: number;
  readonly entry: FileEntry;
}

function ContextMenu({
  menu,
  onEdit, onDownload, onRename, onDelete, onClose,
}: {
  readonly menu: ContextMenuState;
  readonly onEdit: () => void;
  readonly onDownload: () => void;
  readonly onRename: () => void;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items: { label: string; onClick: () => void; danger?: boolean }[] = [];
  if (!menu.entry.isDirectory && isTextFile(menu.entry.name)) {
    items.push({ label: '编辑', onClick: onEdit });
  }
  if (!menu.entry.isDirectory) {
    items.push({ label: '下载', onClick: onDownload });
  }
  items.push({ label: '重命名', onClick: onRename });
  items.push({ label: '删除', onClick: onDelete, danger: true });

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white/90 dark:bg-slate-900/75 border border-white/55 dark:border-primary-300/20 rounded-xl shadow-2xl backdrop-blur-xl py-1 min-w-[120px]"
      style={{ left: menu.x, top: menu.y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.onClick(); onClose(); }}
          className={`w-full text-left px-4 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
            item.danger ? 'text-red-500' : 'text-gray-700 dark:text-gray-200'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ── Main Component ──

export function FileManagerTab({ serverId }: FileManagerTabProps) {
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<readonly FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Editor state
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [fileSaving, setFileSaving] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);

  // Create dir state
  const [showNewDir, setShowNewDir] = useState(false);
  const [newDirName, setNewDirName] = useState('');

  // Rename state
  const [renamingEntry, setRenamingEntry] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Version history state
  const [showVersions, setShowVersions] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAutoSavedRef = useRef<string>('');

  const formatFileApiError = useCallback((err: unknown, fallback: string): string => {
    if (err instanceof ApiError) {
      switch (err.code) {
        case 'FILE_REMOTE_TIMEOUT':
          return '远程文件操作超时，请稍后重试。';
        case 'FILE_REMOTE_UNAVAILABLE':
          return '远程文件服务不可用，请检查 SSH 连接状态后重试。';
        case 'FILE_PATH_OUT_OF_BOUNDS':
          return '访问路径超出服务器允许范围，请检查目标目录。';
        case 'FILE_PERMISSION_DENIED':
          return '权限不足，无法执行该文件操作。';
        case 'FILE_NOT_FOUND':
          return '目标文件或目录不存在，可能已被移动或删除。';
        case 'FILE_ALREADY_EXISTS':
          return '目标名称已存在，请更换名称后重试。';
        default:
          return err.message || fallback;
      }
    }
    if (err instanceof Error && err.message.trim()) {
      return err.message;
    }
    return fallback;
  }, []);

  const reportError = useCallback((err: unknown, fallback: string): string => {
    const message = formatFileApiError(err, fallback);
    setError(message);
    useDialogStore.getState().showToast(message, 'error');
    return message;
  }, [formatFileApiError]);

  const reportSuccess = useCallback((message: string) => {
    setError('');
    useDialogStore.getState().showToast(message, 'success');
  }, []);

  const loadDir = useCallback(async (path: string) => {
    setLoading(true);
    setError('');
    try {
      const list = await serverApi.listFiles(serverId, path);
      // Sort: folders first, then alphabetically
      const sorted = [...list].sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setEntries(sorted);
      setCurrentPath(path);
      setEditingFile(null);
      setRenamingEntry(null);
    } catch (err: unknown) {
      reportError(err, '加载失败');
    } finally {
      setLoading(false);
    }
  }, [reportError, serverId]);

  useEffect(() => {
    loadDir('/');
  }, [loadDir]);

  // ── File Operations ──

  const openFile = async (name: string) => {
    const filePath = buildPath(currentPath, name);
    setFileLoading(true);
    try {
      const res = await serverApi.readFile(serverId, filePath);
      setFileContent(res.content);
      setEditingFile(filePath);
    } catch (err: unknown) {
      reportError(err, '读取失败');
    } finally {
      setFileLoading(false);
    }
  };

  const saveFile = async () => {
    if (!editingFile) return;
    setFileSaving(true);
    try {
      await serverApi.writeFile(serverId, editingFile, fileContent);
      lastAutoSavedRef.current = fileContent;
      reportSuccess('文件保存成功');
    } catch (err: unknown) {
      reportError(err, '保存失败');
    } finally {
      setFileSaving(false);
    }
  };

  // Auto-save draft every 60s when content changes
  useEffect(() => {
    if (!editingFile) {
      if (autoSaveRef.current) { clearInterval(autoSaveRef.current); autoSaveRef.current = null; }
      return;
    }
    lastAutoSavedRef.current = fileContent;
    autoSaveRef.current = setInterval(() => {
      if (editingFile && fileContent !== lastAutoSavedRef.current) {
        lastAutoSavedRef.current = fileContent;
        serverApi.autoSaveFileVersion(serverId, editingFile, fileContent).catch((err: unknown) => {
          reportError(err, '自动保存失败');
        });
      }
    }, 60_000);
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [editingFile, reportError, serverId]);

  const handleEntry = (entry: FileEntry) => {
    if (entry.isDirectory) {
      loadDir(buildPath(currentPath, entry.name));
    } else if (isTextFile(entry.name)) {
      openFile(entry.name);
    }
  };

  const goUp = () => {
    if (currentPath === '/') return;
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    loadDir(parent);
  };

  const handleDelete = async (name: string) => {
    const filePath = buildPath(currentPath, name);
    const ok = await useDialogStore.getState().confirm({
      title: '删除确认',
      message: `确认删除 ${name}？此操作不可恢复。`,
      variant: 'danger',
      confirmLabel: '删除',
    });
    if (!ok) return;
    try {
      await serverApi.deleteFile(serverId, filePath);
      reportSuccess(`已删除 ${name}`);
      loadDir(currentPath);
    } catch (err: unknown) {
      reportError(err, '删除失败');
    }
  };

  const handleCreateDir = async () => {
    if (!newDirName.trim()) return;
    const dirPath = buildPath(currentPath, newDirName.trim());
    try {
      await serverApi.createDir(serverId, dirPath);
      setNewDirName('');
      setShowNewDir(false);
      reportSuccess(`已创建文件夹 ${newDirName.trim()}`);
      loadDir(currentPath);
    } catch (err: unknown) {
      reportError(err, '创建失败');
    }
  };

  // ── Rename ──

  const startRename = (name: string) => {
    setRenamingEntry(name);
    setRenameValue(name);
  };

  const confirmRename = async () => {
    if (!renamingEntry || !renameValue.trim() || renameValue.trim() === renamingEntry) {
      setRenamingEntry(null);
      return;
    }
    const oldPath = buildPath(currentPath, renamingEntry);
    const newPath = buildPath(currentPath, renameValue.trim());
    try {
      await serverApi.renameFile(serverId, oldPath, newPath);
      setRenamingEntry(null);
      reportSuccess(`重命名成功：${renamingEntry} -> ${renameValue.trim()}`);
      loadDir(currentPath);
    } catch (err: unknown) {
      reportError(err, '重命名失败');
    }
  };

  // ── Download ──

  const handleDownload = async (name: string) => {
    const filePath = buildPath(currentPath, name);
    try {
      const res = await serverApi.downloadFile(serverId, filePath);
      const bytes = Uint8Array.from(atob(res.data), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      reportSuccess(`下载完成：${name}`);
    } catch (err: unknown) {
      reportError(err, '下载失败');
    }
  };

  // ── Upload ──

  const uploadFiles = async (files: FileList | File[]) => {
    if (files.length === 0) return;
    const list = Array.from(files);
    setUploading(true);
    setError('');
    try {
      for (const file of list) {
        const data = await fileToBase64(file);
        // Submit async upload task - the task panel will track progress
        await serverApi.uploadFileAsync(serverId, currentPath, file.name, data);
      }
      reportSuccess(`已提交 ${list.length} 个文件上传任务`);
      // Open task panel to show progress
      useFileTaskStore.getState().setPanelVisible(true);
      loadDir(currentPath);
    } catch (err: unknown) {
      reportError(err, '上传任务提交失败');
    } finally {
      setUploading(false);
    }
  };

  const handleInputUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  // ── Context Menu ──

  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const breadcrumbs = currentPath.split('/').filter(Boolean);
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // ── File Editor View ──

  if (editingFile) {
    const filename = editingFile.split('/').pop() ?? '';
    return (
      <div className="flex h-full">
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2 px-4 py-2 bg-white/85 dark:bg-slate-900/70 border-b border-white/55 dark:border-primary-300/20 backdrop-blur-xl">
            <button
              onClick={() => { setEditingFile(null); setShowVersions(false); }}
              className="px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              &larr; 返回
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">{editingFile}</span>
            <button
              onClick={() => setShowVersions((v) => !v)}
              className={`px-3 py-1 text-xs rounded ${
                showVersions
                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                  : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-gray-400'
              }`}
            >
              历史
            </button>
            <button
              onClick={saveFile}
              disabled={fileSaving}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {fileSaving ? '保存中...' : '保存'}
            </button>
          </div>
          {fileLoading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">加载中...</div>
          ) : (
            <div className="flex-1 min-h-0">
              <CodeEditor
                value={fileContent}
                onChange={setFileContent}
                filename={filename}
              />
            </div>
          )}
        </div>
        {showVersions && (
          <FileVersionPanel
            serverId={serverId}
            filePath={editingFile}
            currentContent={fileContent}
            onRestore={(content) => { setFileContent(content); setShowVersions(false); }}
            onClose={() => setShowVersions(false)}
          />
        )}
      </div>
    );
  }

  // ── Directory Listing View ──

  return (
    <div
      className={`flex flex-col h-full ${dragOver ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleInputUpload} />

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={goUp}
          disabled={currentPath === '/'}
          className="px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30"
        >
          &larr; 上级
        </button>
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 min-w-0 overflow-hidden">
          <button onClick={() => loadDir('/')} className="hover:text-blue-500 shrink-0">/</button>
          {breadcrumbs.map((seg, i) => {
            const path = '/' + breadcrumbs.slice(0, i + 1).join('/');
            return (
              <span key={path} className="shrink-0">
                {i > 0 && <span className="mx-0.5">/</span>}
                <button onClick={() => loadDir(path)} className="hover:text-blue-500">{seg}</button>
              </span>
            );
          })}
        </div>
        <div className="flex-1" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 dark:hover:bg-gray-700 rounded disabled:opacity-50"
        >
          {uploading ? '提交中...' : '上传文件'}
        </button>
        <button
          onClick={() => setShowNewDir(!showNewDir)}
          className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded"
        >
          新建文件夹
        </button>
        <button
          onClick={() => loadDir(currentPath)}
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

      {/* Drag overlay hint */}
      {dragOver && (
        <div className="px-4 py-3 text-center text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800">
          松开鼠标上传文件到当前目录
        </div>
      )}

      {showNewDir && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <input
            value={newDirName}
            onChange={(e) => setNewDirName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateDir(); }}
            placeholder="文件夹名称"
            className="flex-1 border rounded px-2 py-1 text-xs dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            autoFocus
          />
          <button onClick={handleCreateDir} className="px-2 py-1 text-xs bg-blue-600 text-white rounded">创建</button>
          <button onClick={() => { setShowNewDir(false); setNewDirName(''); }} className="px-2 py-1 text-xs text-gray-500">取消</button>
        </div>
      )}

      {error && (
        <div className="px-4 py-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/30">{error}</div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">加载中...</div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">空目录</div>
        ) : (
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
                  onContextMenu={(e) => handleContextMenu(e, entry)}
                >
                  <td className="px-4 py-2">
                    {renamingEntry === entry.name ? (
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmRename();
                          if (e.key === 'Escape') setRenamingEntry(null);
                        }}
                        onBlur={confirmRename}
                        className="w-full border rounded px-1 py-0.5 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => handleEntry(entry)}
                        className={`text-left ${
                          entry.isDirectory
                            ? 'text-blue-600 dark:text-blue-400'
                            : isTextFile(entry.name)
                              ? 'text-gray-700 dark:text-gray-200 hover:text-blue-600'
                              : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        <span className="mr-2">{entry.isDirectory ? '📁' : '📄'}</span>
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
                        onClick={() => handleDownload(entry.name)}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        下载
                      </button>
                    )}
                    <button
                      onClick={() => startRename(entry.name)}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      重命名
                    </button>
                    <button
                      onClick={() => handleDelete(entry.name)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onEdit={() => {
            if (isTextFile(contextMenu.entry.name)) openFile(contextMenu.entry.name);
          }}
          onDownload={() => handleDownload(contextMenu.entry.name)}
          onRename={() => startRename(contextMenu.entry.name)}
          onDelete={() => handleDelete(contextMenu.entry.name)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Task Panel */}
      <FileTaskPanel serverId={serverId} />
    </div>
  );
}

// ── Utility ──

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix (e.g., data:application/octet-stream;base64,)
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
