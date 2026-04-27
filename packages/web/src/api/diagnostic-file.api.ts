import { apiFetch } from './client.js';

export interface DiagnosticFile {
  id: string;
  pid: number;
  processName: string;
  fileType: 'thread-dump' | 'heap-dump' | 'jfr' | 'cpu-sample';
  filePath: string;
  fileSize: number;
  createdAt: string;
  description?: string;
}

export interface StorageStats {
  totalSize: number;
  totalFiles: number;
  byType: {
    [key: string]: {
      count: number;
      size: number;
    };
  };
}

export interface ListFilesQuery {
  pid?: number;
  fileType?: string;
  startDate?: string;
  endDate?: string;
}

export const diagnosticFileApi = {
  async listFiles(query: ListFilesQuery = {}): Promise<DiagnosticFile[]> {
    const params = new URLSearchParams();
    if (query.pid !== undefined) params.append('pid', query.pid.toString());
    if (query.fileType) params.append('fileType', query.fileType);
    if (query.startDate) params.append('startDate', query.startDate);
    if (query.endDate) params.append('endDate', query.endDate);

    const queryString = params.toString();
    const url = `/diagnostic-files${queryString ? `?${queryString}` : ''}`;
    return apiFetch<DiagnosticFile[]>(url);
  },

  async getFile(id: string): Promise<DiagnosticFile> {
    return apiFetch<DiagnosticFile>(`/diagnostic-files/${id}`);
  },

  async downloadFile(id: string): Promise<void> {
    const file = await this.getFile(id);
    const fileName = file.filePath.split('/').pop() || 'download';
    
    // 触发浏览器下载
    const link = document.createElement('a');
    link.href = `/api/v1/diagnostic-files/${id}/download`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  async deleteFile(id: string): Promise<void> {
    await apiFetch<{ success: boolean; message: string }>(`/diagnostic-files/${id}`, {
      method: 'DELETE',
    });
  },

  async deleteFiles(ids: string[]): Promise<void> {
    await apiFetch<{ success: boolean; message: string }>('/diagnostic-files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
  },

  async getStorageStats(): Promise<StorageStats> {
    return apiFetch<StorageStats>('/diagnostic-files/stats');
  },

  async cleanup(olderThanDays: number, fileTypes?: string[]): Promise<{ deletedCount: number }> {
    const result = await apiFetch<{ success: boolean; deletedCount: number; message: string }>(
      '/diagnostic-files/cleanup',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ olderThanDays, fileTypes }),
      },
    );
    return { deletedCount: result.deletedCount };
  },
};
