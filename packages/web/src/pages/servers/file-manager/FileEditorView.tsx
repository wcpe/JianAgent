import { CodeEditor } from '../CodeEditor.js';
import { FileVersionPanel } from '../FileVersionPanel.js';

interface FileEditorViewProps {
  readonly serverId: string;
  readonly editingFile: string;
  readonly fileContent: string;
  readonly fileLoading: boolean;
  readonly fileSaving: boolean;
  readonly showVersions: boolean;
  readonly onContentChange: (content: string) => void;
  readonly onSave: () => void;
  readonly onBack: () => void;
  readonly onToggleVersions: () => void;
  readonly onRestore: (content: string) => void;
}

export function FileEditorView({
  serverId,
  editingFile,
  fileContent,
  fileLoading,
  fileSaving,
  showVersions,
  onContentChange,
  onSave,
  onBack,
  onToggleVersions,
  onRestore,
}: FileEditorViewProps) {
  const filename = editingFile.split('/').pop() ?? '';

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2 px-4 py-2 bg-white/85 dark:bg-gray-900/70 border-b border-white/55 dark:border-primary-300/20 backdrop-blur-xl">
          <button
            onClick={onBack}
            className="px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            &larr; 返回
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">{editingFile}</span>
          <button
            onClick={onToggleVersions}
            className={`px-3 py-1 text-xs rounded ${
              showVersions
                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-gray-400'
            }`}
          >
            历史
          </button>
          <button
            onClick={onSave}
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
              onChange={onContentChange}
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
          onRestore={onRestore}
          onClose={onToggleVersions}
        />
      )}
    </div>
  );
}
