import { useState, useEffect, useCallback, useRef } from 'react';
import { serverApi } from '../../api/server.api.js';

interface FileVersionPanelProps {
  readonly serverId: string;
  readonly filePath: string;
  readonly currentContent: string;
  readonly onRestore: (content: string) => void;
  readonly onClose: () => void;
}

interface VersionItem {
  readonly id: string;
  readonly source: string;
  readonly userId: string;
  readonly createdAt: number;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN');
}

function computeDiffLines(
  oldText: string,
  newText: string,
): readonly { type: 'same' | 'add' | 'remove'; line: string }[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: { type: 'same' | 'add' | 'remove'; line: string }[] = [];

  const maxLen = Math.max(oldLines.length, newLines.length);
  // Simple LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  // Backtrack
  const ops: { type: 'same' | 'add' | 'remove'; line: string }[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.push({ type: 'same', line: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'add', line: newLines[j - 1] });
      j--;
    } else {
      ops.push({ type: 'remove', line: oldLines[i - 1] });
      i--;
    }
  }
  ops.reverse();
  return ops;
}

export function FileVersionPanel({
  serverId,
  filePath,
  currentContent,
  onRestore,
  onClose,
}: FileVersionPanelProps) {
  const [versions, setVersions] = useState<readonly VersionItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [versionContent, setVersionContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    serverApi.listFileVersions(serverId, filePath).then(setVersions).catch(() => {});
  }, [serverId, filePath]);

  const loadVersion = useCallback(async (vid: string) => {
    setSelectedId(vid);
    setLoading(true);
    try {
      const v = await serverApi.getFileVersion(serverId, vid);
      setVersionContent(v.content);
    } catch {
      setVersionContent(null);
    }
    setLoading(false);
  }, [serverId]);

  const handleRestore = useCallback(async () => {
    if (!selectedId) return;
    try {
      await serverApi.restoreFileVersion(serverId, selectedId);
      if (versionContent !== null) onRestore(versionContent);
    } catch { /* ignore */ }
  }, [serverId, selectedId, versionContent, onRestore]);

  const diffLines = versionContent !== null
    ? computeDiffLines(versionContent, currentContent)
    : null;

  return (
    <div className="flex flex-col h-full bg-white border-l w-[400px] shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
        <span className="text-sm font-medium">历史版本</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
      </div>

      {/* Version list */}
      <div className="border-b overflow-y-auto max-h-48">
        {versions.length === 0 && (
          <div className="text-sm text-gray-400 p-3">暂无历史版本</div>
        )}
        {versions.map((v) => (
          <button
            key={v.id}
            onClick={() => loadVersion(v.id)}
            className={`w-full text-left px-3 py-2 text-xs border-b hover:bg-gray-50 flex items-center justify-between ${
              selectedId === v.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
            }`}
          >
            <div>
              <div className="text-gray-700">{formatTime(v.createdAt)}</div>
              <div className="text-gray-400">{v.userId || '未知用户'}</div>
            </div>
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
              v.source === 'auto'
                ? 'bg-gray-100 text-gray-500'
                : 'bg-blue-100 text-blue-600'
            }`}>
              {v.source === 'auto' ? '自动' : '手动'}
            </span>
          </button>
        ))}
      </div>

      {/* Diff view */}
      <div className="flex-1 overflow-auto">
        {loading && <div className="p-3 text-sm text-gray-400">加载中...</div>}
        {!loading && selectedId && diffLines && (
          <div className="font-mono text-xs leading-5">
            {diffLines.map((d, i) => (
              <div
                key={i}
                className={
                  d.type === 'add'
                    ? 'bg-green-50 text-green-800 px-2'
                    : d.type === 'remove'
                    ? 'bg-red-50 text-red-800 px-2'
                    : 'px-2 text-gray-600'
                }
              >
                <span className="inline-block w-4 text-gray-400 select-none mr-1">
                  {d.type === 'add' ? '+' : d.type === 'remove' ? '-' : ' '}
                </span>
                {d.line || '\u00A0'}
              </div>
            ))}
          </div>
        )}
        {!loading && selectedId && !diffLines && (
          <div className="p-3 text-sm text-gray-400">无法加载版本内容</div>
        )}
        {!selectedId && (
          <div className="p-3 text-sm text-gray-400">选择一个版本查看差异</div>
        )}
      </div>

      {/* Restore button */}
      {selectedId && versionContent !== null && (
        <div className="border-t px-3 py-2">
          <button
            onClick={handleRestore}
            className="w-full px-3 py-1.5 bg-orange-500 text-white rounded text-sm hover:bg-orange-600"
          >
            回滚到此版本
          </button>
        </div>
      )}
    </div>
  );
}
