import { ApiError } from '../../../api/client.js';

export const TEXT_EXTENSIONS = new Set([
  '.yml', '.yaml', '.properties', '.json', '.txt', '.cfg', '.conf',
  '.toml', '.log', '.md', '.xml', '.sh', '.bat', '.cmd', '.csv', '.ini',
]);

export function isTextFile(name: string): boolean {
  const ext = name.lastIndexOf('.') >= 0 ? name.slice(name.lastIndexOf('.')) : '';
  return TEXT_EXTENSIONS.has(ext.toLowerCase());
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildPath(currentPath: string, name: string): string {
  return currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
}

export function fileToBase64(file: File): Promise<string> {
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

export function formatFileApiError(err: unknown, fallback: string): string {
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
}
