import { apiFetch } from './client.js';
import type {
  ServerConfig,
  CreateServerConfigRequest,
  UpdateServerConfigRequest,
  BackupDto,
  BackupScheduleDto,
  CreateBackupRequest,
  UpdateBackupScheduleRequest,
  FileTaskDto,
  FileTaskRequest,
  PluginMetadataDto,
  PluginOperationResultDto,
  ProvisionServerRequest,
  ProvisionServerResponse,
  PaperVersionInfo,
} from '@jian-agent/shared-domain';

// ── Re-export sub-modules for backward compatibility ──
export { serverLifecycleApi } from './server-lifecycle.api.js';
export { serverSshApi, type SshStatusResponse, type SshSessionsResponse } from './server-ssh.api.js';
export { serverMonitoringApi } from './server-monitoring.api.js';

// ── Local interfaces (used by file / log operations) ──

export interface FileEntry {
  readonly name: string;
  readonly isDirectory: boolean;
  readonly size: number;
  readonly modifiedAt: string;
}

export interface LogFileEntry {
  readonly name: string;
  readonly size: number;
  readonly modifiedAt: string;
  readonly isGzipped: boolean;
}

export interface LogSearchResult {
  readonly file: string;
  readonly line: number;
  readonly content: string;
}

// ── Barrel: unified serverApi object ──
// Delegates to sub-modules so that callers importing { serverApi } keep working.

import { serverLifecycleApi } from './server-lifecycle.api.js';
import { serverSshApi } from './server-ssh.api.js';
import { serverMonitoringApi } from './server-monitoring.api.js';

export const serverApi = {
  // ── Lifecycle (delegated) ──
  ...serverLifecycleApi,

  // ── SSH (delegated) ──
  ...serverSshApi,

  // ── Monitoring (delegated) ──
  ...serverMonitoringApi,

  // ── Server Config CRUD ──

  getServerConfig: (id: string) =>
    apiFetch<ServerConfig>(`/servers/${encodeURIComponent(id)}/config`),

  createServer: (dto: CreateServerConfigRequest) =>
    apiFetch<ServerConfig>('/servers', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  updateServer: (id: string, dto: UpdateServerConfigRequest) =>
    apiFetch<ServerConfig>(`/servers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    }),

  deleteServer: (id: string) =>
    apiFetch<void>(`/servers/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // ── File Management (Sync short operations) ──

  listFiles: (id: string, path: string) =>
    apiFetch<readonly FileEntry[]>(`/servers/${encodeURIComponent(id)}/files?path=${encodeURIComponent(path)}`),

  readFile: (id: string, path: string) =>
    apiFetch<{ content: string }>(`/servers/${encodeURIComponent(id)}/files/content?path=${encodeURIComponent(path)}`),

  writeFile: (id: string, path: string, content: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/files/content`, {
      method: 'PUT',
      body: JSON.stringify({ path, content }),
    }),

  deleteFile: (id: string, path: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/files?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    }),

  createDir: (id: string, path: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/files/mkdir`, {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  renameFile: (id: string, oldPath: string, newPath: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/files/rename`, {
      method: 'POST',
      body: JSON.stringify({ oldPath, newPath }),
    }),

  // ── File Management (Async long operations) ──

  uploadFile: (id: string, dirPath: string, filename: string, data: string) =>
    apiFetch<{ taskId: string }>(`/servers/${encodeURIComponent(id)}/files/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        kind: 'UPLOAD',
        dirPath,
        filename,
        data,
      }),
    }),

  createFileTask: (id: string, request: FileTaskRequest) =>
    apiFetch<{ taskId: string }>(`/servers/${encodeURIComponent(id)}/files/tasks`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  uploadFileAsync: (id: string, dirPath: string, filename: string, data: string) =>
    apiFetch<{ taskId: string }>(`/servers/${encodeURIComponent(id)}/files/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        kind: 'UPLOAD',
        dirPath,
        filename,
        data,
      }),
    }),

  packDownloadAsync: (id: string, paths: string[]) =>
    apiFetch<{ taskId: string }>(`/servers/${encodeURIComponent(id)}/files/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        kind: 'PACK_DOWNLOAD',
        paths,
      }),
    }),

  dirCopyAsync: (id: string, sourcePath: string, destPath: string) =>
    apiFetch<{ taskId: string }>(`/servers/${encodeURIComponent(id)}/files/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        kind: 'DIR_COPY',
        sourcePath,
        destPath,
      }),
    }),

  dirMoveAsync: (id: string, sourcePath: string, destPath: string) =>
    apiFetch<{ taskId: string }>(`/servers/${encodeURIComponent(id)}/files/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        kind: 'DIR_MOVE',
        sourcePath,
        destPath,
      }),
    }),

  compressAsync: (id: string, sourcePaths: string[], archivePath: string) =>
    apiFetch<{ taskId: string }>(`/servers/${encodeURIComponent(id)}/files/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        kind: 'COMPRESS',
        sourcePaths,
        archivePath,
      }),
    }),

  decompressAsync: (id: string, archivePath: string, destDir: string) =>
    apiFetch<{ taskId: string }>(`/servers/${encodeURIComponent(id)}/files/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        kind: 'DECOMPRESS',
        archivePath,
        destDir,
      }),
    }),

  // ── Task Management ──

  listFileTasks: (id: string) =>
    apiFetch<readonly FileTaskDto[]>(`/servers/${encodeURIComponent(id)}/files/tasks`),

  getFileTask: (id: string, taskId: string) =>
    apiFetch<FileTaskDto>(`/servers/${encodeURIComponent(id)}/files/tasks/${encodeURIComponent(taskId)}`),

  cancelFileTask: (id: string, taskId: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/files/tasks/${encodeURIComponent(taskId)}/cancel`, {
      method: 'POST',
    }),

  downloadTaskArtifact: (id: string, taskId: string) =>
    apiFetch<{ filename: string; data: string; size: number }>(
      `/servers/${encodeURIComponent(id)}/files/tasks/${encodeURIComponent(taskId)}/artifact`,
    ),

  // ── Legacy single-file download (sync) ──

  downloadFile: (id: string, path: string) =>
    apiFetch<{ filename: string; data: string; size: number }>(`/servers/${encodeURIComponent(id)}/files/download?path=${encodeURIComponent(path)}`),

  // ── File Versions ──

  listFileVersions: (id: string, path: string) =>
    apiFetch<readonly { id: string; serverId: string; filePath: string; userId: string; source: string; createdAt: number }[]>(
      `/servers/${encodeURIComponent(id)}/files/versions?path=${encodeURIComponent(path)}`,
    ),

  getFileVersion: (id: string, versionId: string) =>
    apiFetch<{ id: string; content: string; source: string; createdAt: number }>(
      `/servers/${encodeURIComponent(id)}/files/versions/${encodeURIComponent(versionId)}`,
    ),

  restoreFileVersion: (id: string, versionId: string) =>
    apiFetch<{ success: boolean }>(
      `/servers/${encodeURIComponent(id)}/files/versions/${encodeURIComponent(versionId)}/restore`,
      { method: 'POST' },
    ),

  autoSaveFileVersion: (id: string, path: string, content: string) =>
    apiFetch<{ success: boolean; versionId: string }>(
      `/servers/${encodeURIComponent(id)}/files/versions/auto`,
      { method: 'POST', body: JSON.stringify({ path, content }) },
    ),

  // ── Plugin Management ──

  listPlugins: (id: string) =>
    apiFetch<readonly PluginMetadataDto[]>(`/servers/${encodeURIComponent(id)}/plugins`),

  deletePlugin: (id: string, name: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/plugins/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    }),

  enablePlugin: (id: string, name: string) =>
    apiFetch<PluginOperationResultDto>(`/servers/${encodeURIComponent(id)}/plugins/${encodeURIComponent(name)}/enable`, {
      method: 'POST',
    }),

  disablePlugin: (id: string, name: string) =>
    apiFetch<PluginOperationResultDto>(`/servers/${encodeURIComponent(id)}/plugins/${encodeURIComponent(name)}/disable`, {
      method: 'POST',
    }),

  hotLoadPlugin: (id: string, name: string) =>
    apiFetch<PluginOperationResultDto>(`/servers/${encodeURIComponent(id)}/plugins/${encodeURIComponent(name)}/hot-load`, {
      method: 'POST',
    }),

  hotUnloadPlugin: (id: string, name: string) =>
    apiFetch<PluginOperationResultDto>(`/servers/${encodeURIComponent(id)}/plugins/${encodeURIComponent(name)}/hot-unload`, {
      method: 'POST',
    }),

  hotReloadPlugin: (id: string, name: string) =>
    apiFetch<PluginOperationResultDto>(`/servers/${encodeURIComponent(id)}/plugins/${encodeURIComponent(name)}/hot-reload`, {
      method: 'POST',
    }),

  replacePluginVersion: (id: string, name: string, filename: string, data: string, hotSwap = true) =>
    apiFetch<PluginOperationResultDto>(`/servers/${encodeURIComponent(id)}/plugins/${encodeURIComponent(name)}/replace`, {
      method: 'POST',
      body: JSON.stringify({ filename, data, hotSwap }),
    }),

  // ── Log Files ──

  listLogFiles: (id: string) =>
    apiFetch<readonly LogFileEntry[]>(`/servers/${encodeURIComponent(id)}/log-files`),

  readLogFile: (id: string, filename: string) =>
    apiFetch<{ content: string }>(`/servers/${encodeURIComponent(id)}/log-files/${encodeURIComponent(filename)}`),

  tailLogFile: (id: string, filename: string, lines = 200) =>
    apiFetch<{ content: string }>(`/servers/${encodeURIComponent(id)}/log-files/${encodeURIComponent(filename)}/tail?lines=${lines}`),

  searchLogFiles: (id: string, query: string, files?: readonly string[]) =>
    apiFetch<readonly LogSearchResult[]>(
      `/servers/${encodeURIComponent(id)}/log-files/search?q=${encodeURIComponent(query)}${files?.length ? `&files=${files.map(encodeURIComponent).join(',')}` : ''}`,
    ),

  // ── Backups ──

  listBackups: (id: string) =>
    apiFetch<readonly BackupDto[]>(`/servers/${encodeURIComponent(id)}/backups`),

  createBackup: (id: string, request: CreateBackupRequest) =>
    apiFetch<BackupDto>(`/servers/${encodeURIComponent(id)}/backups`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  deleteBackup: (id: string, backupId: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/backups/${encodeURIComponent(backupId)}`, {
      method: 'DELETE',
    }),

  downloadBackup: (id: string, backupId: string) =>
    apiFetch<{ filename: string; data: string; size: number }>(
      `/servers/${encodeURIComponent(id)}/backups/${encodeURIComponent(backupId)}/download`,
    ),

  getBackupSchedule: (id: string) =>
    apiFetch<BackupScheduleDto>(`/servers/${encodeURIComponent(id)}/backups/schedule`),

  updateBackupSchedule: (id: string, request: UpdateBackupScheduleRequest) =>
    apiFetch<BackupScheduleDto>(`/servers/${encodeURIComponent(id)}/backups/schedule`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  // ── Server Provision ──

  provisionServer: (dto: ProvisionServerRequest) =>
    apiFetch<ProvisionServerResponse>('/servers/provision', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  listPaperVersions: () =>
    apiFetch<PaperVersionInfo[]>('/servers/paper-versions'),
} as const;
