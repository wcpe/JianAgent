import React, { useState } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';

interface CleanupDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (olderThanDays: number, fileTypes?: string[]) => void;
}

const FILE_TYPE_OPTIONS = [
  { value: 'thread-dump', label: '线程转储' },
  { value: 'heap-dump', label: '堆转储' },
  { value: 'jfr', label: 'JFR 录制' },
  { value: 'cpu-sample', label: 'CPU 采样' },
];

export function CleanupDialog({ open, onClose, onConfirm }: CleanupDialogProps) {
  const [olderThanDays, setOlderThanDays] = useState(30);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm(olderThanDays, selectedTypes.length > 0 ? selectedTypes : undefined);
    onClose();
  };

  const handleTypeToggle = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter((t) => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold text-gray-900">清理旧文件</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">警告：此操作不可撤销</p>
              <p>删除的文件将无法恢复，请谨慎操作。</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* 天数选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                删除早于多少天的文件
              </label>
              <input
                type="number"
                min="1"
                value={olderThanDays}
                onChange={(e) => setOlderThanDays(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                将删除创建时间早于 {olderThanDays} 天前的文件
              </p>
            </div>

            {/* 文件类型选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                文件类型（可选）
              </label>
              <div className="space-y-2">
                {FILE_TYPE_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(option.value)}
                      onChange={() => handleTypeToggle(option.value)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {selectedTypes.length === 0
                  ? '未选择类型时，将清理所有类型的文件'
                  : `将清理选中的 ${selectedTypes.length} 种类型`}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
          >
            确认清理
          </button>
        </div>
      </div>
    </div>
  );
}
