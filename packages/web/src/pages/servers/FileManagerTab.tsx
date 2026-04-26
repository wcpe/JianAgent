import { useState, useEffect, useCallback, useRef } from 'react';
import { serverApi, type FileEntry } from '../../api/server.api.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import { FileTaskPanel, useFileTaskStore } from '../../features/file-tasks/index.js';
import {
  isTextFile, buildPath, fileToBase64, formatFileApiError,
  FileContextMenu, type ContextMenuState,
  FileEditorView,
  FileListToolbar,
  FileListTable,
} from './file-manager/index.js';
import { ErrorAlert } from '../../components/ui/ErrorAlert.js';

interface FileManagerTabProps {
  readonly serverId: string;
}

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

  const reportError = useCallback((err: unknown, fallback: string): string => {
    const message = formatFileApiError(err, fallback);
    setError(message);
    useDialogStore.getState().showToast(message, 'error');
    return message;
  }, []);

  const reportSuccess = useCallback((message: string) => {
    setError('');
    useDialogStore.getState().showToast(message, 'success');
  }, []);

  const loadDir = useCallback(async (path: string) => {
    setLoading(true);
    setError('');
    try {
      const list = await serverApi.listFiles(serverId, path);
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
        await serverApi.uploadFileAsync(serverId, currentPath, file.name, data);
      }
      reportSuccess(`已提交 ${list.length} 个文件上传任务`);
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

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); };

  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const breadcrumbs = currentPath.split('/').filter(Boolean);

  if (editingFile) {
    return (
      <FileEditorView
        serverId={serverId}
        editingFile={editingFile}
        fileContent={fileContent}
        fileLoading={fileLoading}
        fileSaving={fileSaving}
        showVersions={showVersions}
        onContentChange={setFileContent}
        onSave={saveFile}
        onBack={() => { setEditingFile(null); setShowVersions(false); }}
        onToggleVersions={() => setShowVersions((v) => !v)}
        onRestore={(content) => { setFileContent(content); setShowVersions(false); }}
      />
    );
  }

  return (
    <div
      className={`flex flex-col h-full ${dragOver ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleInputUpload} />

      <FileListToolbar
        currentPath={currentPath}
        breadcrumbs={breadcrumbs}
        uploading={uploading}
        showNewDir={showNewDir}
        newDirName={newDirName}
        onGoUp={goUp}
        onNavigate={loadDir}
        onRefresh={() => loadDir(currentPath)}
        onUploadClick={() => fileInputRef.current?.click()}
        onToggleNewDir={() => setShowNewDir(!showNewDir)}
        onNewDirNameChange={setNewDirName}
        onCreateDir={handleCreateDir}
        onCancelNewDir={() => { setShowNewDir(false); setNewDirName(''); }}
      />

      {dragOver && (
        <div className="px-4 py-3 text-center text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800">
          松开鼠标上传文件到当前目录
        </div>
      )}

      {error && <ErrorAlert message={error} />}

      <div className="flex-1 overflow-y-auto">
        <FileListTable
          entries={entries}
          loading={loading}
          renamingEntry={renamingEntry}
          renameValue={renameValue}
          onEntryClick={handleEntry}
          onContextMenu={handleContextMenu}
          onRenameValueChange={setRenameValue}
          onConfirmRename={confirmRename}
          onCancelRename={() => setRenamingEntry(null)}
          onDownload={handleDownload}
          onStartRename={startRename}
          onDelete={handleDelete}
        />
      </div>

      {contextMenu && (
        <FileContextMenu
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

      <FileTaskPanel serverId={serverId} />
    </div>
  );
}
