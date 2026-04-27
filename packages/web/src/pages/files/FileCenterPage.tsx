import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Trash2, Download, RefreshCw, FolderOpen } from 'lucide-react';
import { diagnosticFileApi, DiagnosticFile, ListFilesQuery, StorageStats as StorageStatsType } from '../../api/diagnostic-file.api';
import { StorageStats } from './components/StorageStats';
import { FileFilters } from './components/FileFilters';
import { FileList } from './components/FileList';
import { CleanupDialog } from './components/CleanupDialog';
import { useDialogStore } from '../../stores/dialog.store';

export function FileCenterPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [allFiles, setAllFiles] = useState<DiagnosticFile[]>([]);
  const [stats, setStats] = useState<StorageStatsType | null>(null);
  const [filters, setFilters] = useState<ListFilesQuery>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);

  const showToast = useDialogStore((state) => state.showToast);
  const confirm = useDialogStore((state) => state.confirm);

  // 加载文件列表
  const loadFiles = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const files = await diagnosticFileApi.listFiles(filters);
      setAllFiles(files);
    } catch (error: any) {
      showToast(error?.message ?? '加载文件列表失败', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, showToast]);

  // 加载存储统计
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const statsData = await diagnosticFileApi.getStorageStats();
      setStats(statsData);
    } catch (error: any) {
      showToast(error?.message ?? '加载存储统计失败', 'error');
    } finally {
      setStatsLoading(false);
    }
  }, [showToast]);

  // 初始加载
  useEffect(() => {
    void loadFiles();
    void loadStats();
  }, [loadFiles, loadStats]);

  // 过滤文件（客户端搜索）
  const filteredFiles = useMemo(() => {
    if (!searchTerm) return allFiles;
    const term = searchTerm.toLowerCase();
    return allFiles.filter(
      (file) =>
        file.processName.toLowerCase().includes(term) ||
        file.description?.toLowerCase().includes(term) ||
        file.filePath.toLowerCase().includes(term),
    );
  }, [allFiles, searchTerm]);

  // 刷新
  const handleRefresh = () => {
    void loadFiles(false);
    void loadStats();
  };

  // 重置过滤器
  const handleResetFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

  // 下载文件
  const handleDownload = async (file: DiagnosticFile) => {
    try {
      await diagnosticFileApi.downloadFile(file.id);
      showToast('文件下载已开始', 'success');
    } catch (error: any) {
      showToast(error?.message ?? '下载文件失败', 'error');
    }
  };

  // 删除单个文件
  const handleDelete = async (file: DiagnosticFile) => {
    const confirmed = await confirm({
      title: '确认删除',
      message: `确定要删除文件 "${file.filePath.split('/').pop()}" 吗？此操作不可撤销。`,
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await diagnosticFileApi.deleteFile(file.id);
      showToast('文件已删除', 'success');
      setSelectedIds(selectedIds.filter((id) => id !== file.id));
      void loadFiles(false);
      void loadStats();
    } catch (error: any) {
      showToast(error?.message ?? '删除文件失败', 'error');
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      showToast('请先选择要删除的文件', 'info');
      return;
    }

    const confirmed = await confirm({
      title: '确认批量删除',
      message: `确定要删除选中的 ${selectedIds.length} 个文件吗？此操作不可撤销。`,
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await diagnosticFileApi.deleteFiles(selectedIds);
      showToast(`已删除 ${selectedIds.length} 个文件`, 'success');
      setSelectedIds([]);
      void loadFiles(false);
      void loadStats();
    } catch (error: any) {
      showToast(error?.message ?? '批量删除失败', 'error');
    }
  };

  // 清理旧文件
  const handleCleanup = async (olderThanDays: number, fileTypes?: string[]) => {
    try {
      const result = await diagnosticFileApi.cleanup(olderThanDays, fileTypes);
      showToast(`已清理 ${result.deletedCount} 个文件`, 'success');
      setSelectedIds([]);
      void loadFiles(false);
      void loadStats();
    } catch (error: any) {
      showToast(error?.message ?? '清理失败', 'error');
    }
  };

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-blue-600" />
              <span className="text-lg font-semibold text-gray-900">文件中心</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                刷新
              </button>
              {selectedIds.length > 0 && (
                <button
                  onClick={handleBatchDelete}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  删除选中 ({selectedIds.length})
                </button>
              )}
              <button
                onClick={() => setCleanupDialogOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                清理旧文件
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 存储统计 */}
      <StorageStats stats={stats} loading={statsLoading} />

      {/* 过滤器 */}
      <FileFilters
        filters={filters}
        searchTerm={searchTerm}
        onFiltersChange={setFilters}
        onSearchChange={setSearchTerm}
        onReset={handleResetFilters}
      />

      {/* 文件列表 */}
      <FileList
        files={filteredFiles}
        loading={loading}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onDownload={handleDownload}
        onDelete={handleDelete}
      />

      {/* 清理对话框 */}
      <CleanupDialog
        open={cleanupDialogOpen}
        onClose={() => setCleanupDialogOpen(false)}
        onConfirm={handleCleanup}
      />
    </div>
  );
}
