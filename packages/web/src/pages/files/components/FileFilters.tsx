import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import type { ListFilesQuery } from '../../../api/diagnostic-file.api';

interface FileFiltersProps {
  filters: ListFilesQuery;
  searchTerm: string;
  onFiltersChange: (filters: ListFilesQuery) => void;
  onSearchChange: (term: string) => void;
  onReset: () => void;
}

const FILE_TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'thread-dump', label: '线程转储' },
  { value: 'heap-dump', label: '堆转储' },
  { value: 'jfr', label: 'JFR 录制' },
  { value: 'cpu-sample', label: 'CPU 采样' },
];

export function FileFilters({
  filters,
  searchTerm,
  onFiltersChange,
  onSearchChange,
  onReset,
}: FileFiltersProps) {
  const hasActiveFilters = filters.pid || filters.fileType || filters.startDate || filters.endDate || searchTerm;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-semibold text-gray-700">过滤条件</span>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="ml-auto text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            清除
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 搜索框 */}
        <div className="lg:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">搜索</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索进程名称或描述..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* 进程 PID */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">进程 PID</label>
          <input
            type="number"
            placeholder="输入 PID"
            value={filters.pid || ''}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                pid: e.target.value ? parseInt(e.target.value, 10) : undefined,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 文件类型 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">文件类型</label>
          <select
            value={filters.fileType || ''}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                fileType: e.target.value || undefined,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {FILE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* 日期范围 */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">开始日期</label>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  startDate: e.target.value || undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">结束日期</label>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  endDate: e.target.value || undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
