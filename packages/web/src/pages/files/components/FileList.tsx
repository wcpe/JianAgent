import React, { useState } from 'react';
import { Download, Trash2, FileText, Database, Activity, Cpu, Calendar, HardDrive } from 'lucide-react';
import type { DiagnosticFile } from '../../../api/diagnostic-file.api';

interface FileListProps {
  files: DiagnosticFile[];
  loading: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onDownload: (file: DiagnosticFile) => void;
  onDelete: (file: DiagnosticFile) => void;
}

const FILE_TYPE_LABELS: Record<string, string> = {
  'thread-dump': '线程转储',
  'heap-dump': '堆转储',
  'jfr': 'JFR 录制',
  'cpu-sample': 'CPU 采样',
};

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  'thread-dump': <FileText className="w-4 h-4" />,
  'heap-dump': <Database className="w-4 h-4" />,
  'jfr': <Activity className="w-4 h-4" />,
  'cpu-sample': <Cpu className="w-4 h-4" />,
};

const FILE_TYPE_COLORS: Record<string, string> = {
  'thread-dump': 'bg-blue-100 text-blue-700',
  'heap-dump': 'bg-purple-100 text-purple-700',
  'jfr': 'bg-green-100 text-green-700',
  'cpu-sample': 'bg-orange-100 text-orange-700',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function FileList({
  files,
  loading,
  selectedIds,
  onSelectionChange,
  onDownload,
  onDelete,
}: FileListProps) {
  const [sortField, setSortField] = useState<'createdAt' | 'fileSize' | 'fileType'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: 'createdAt' | 'fileSize' | 'fileType') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedFiles = [...files].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'createdAt') {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (sortField === 'fileSize') {
      comparison = a.fileSize - b.fileSize;
    } else if (sortField === 'fileType') {
      comparison = a.fileType.localeCompare(b.fileType);
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(files.map((f) => f.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    }
  };

  const allSelected = files.length > 0 && selectedIds.length === files.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < files.length;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">加载中...</span>
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
        <div className="text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-lg font-medium">暂无文件</p>
          <p className="text-sm mt-1">执行诊断操作后，文件将显示在这里</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left w-12">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('fileType')}
              >
                类型 {sortField === 'fileType' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                进程
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                文件路径
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('fileSize')}
              >
                大小 {sortField === 'fileSize' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('createdAt')}
              >
                创建时间 {sortField === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedFiles.map((file) => (
              <tr key={file.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(file.id)}
                    onChange={(e) => handleSelectOne(file.id, e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${FILE_TYPE_COLORS[file.fileType]}`}
                  >
                    {FILE_TYPE_ICONS[file.fileType]}
                    {FILE_TYPE_LABELS[file.fileType]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900">{file.processName}</div>
                  <div className="text-xs text-gray-500">PID: {file.pid}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-900 font-mono truncate max-w-xs" title={file.filePath}>
                    {file.filePath.split('/').pop()}
                  </div>
                  {file.description && (
                    <div className="text-xs text-gray-500 truncate max-w-xs" title={file.description}>
                      {file.description}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-sm text-gray-700">
                    <HardDrive className="w-3.5 h-3.5 text-gray-400" />
                    {formatBytes(file.fileSize)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-sm text-gray-700">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    {formatDate(file.createdAt)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onDownload(file)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="下载"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(file)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
