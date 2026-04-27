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
