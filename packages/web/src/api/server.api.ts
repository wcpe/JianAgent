import { apiFetch } from './client.js';
import type {
  ServerConfig,
  ServerWithStatusDto,
  CreateServerConfigRequest,
  UpdateServerConfigRequest,
  BackupDto,
  BackupScheduleDto,
  CreateBackupRequest,
  UpdateBackupScheduleRequest,
  ConditionalStopDto,
  ConditionType,
  StartTemplateDto,
  CreateStartTemplateDto,
  UpdateStartTemplateDto,
  FileTaskDto,
  FileTaskRequest,
  PluginMetadataDto,
  PluginOperationResultDto,
} from '@jian-agent/shared-domain';

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

export interface SshStatusResponse {
  readonly connected: boolean;
  readonly observability: {
    readonly totalActiveSessions: number;
    readonly perServerQuota: number;
    readonly activeSessionsForServer: number;
    readonly remainingSessionsForServer: number;
    readonly activeSessionIds: readonly string[];
    readonly activeSessionBriefIds: readonly string[];
  };
}

export interface SshSessionsResponse {
  readonly connected: boolean;
  readonly sessions: readonly {
    sessionId: string;
    sessionBriefId: string;
    serverId: string;
    openedAt: string;
    lastActivityAt: string;
    idleForMs: number;
    idleTimeoutMs: number;
  }[];
}

export const serverApi = {
  listServers: () =>
    apiFetch<readonly ServerWithStatusDto[]>('/servers'),

  batchOperation: (action: string, serverIds: string[], stopMode?: string) =>
    apiFetch<{ results: Array<{ serverId: string; success: boolean; error?: string }> }>(
      '/servers/batch',
      { method: 'POST', body: JSON.stringify({ action, serverIds, stopMode }) },
    ),

  getServer: (id: string) =>
    apiFetch<ServerWithStatusDto>(`/servers/${encodeURIComponent(id)}`),

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

  startServer: (id: string) =>
    apiFetch<{ success: boolean; pid?: number }>(`/servers/${encodeURIComponent(id)}/start`, {
      method: 'POST',
    }),

  stopServer: (id: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/stop`, {
      method: 'POST',
    }),

  interruptServer: (id: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/interrupt`, {
      method: 'POST',
    }),

  restartServer: (id: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/restart`, {
      method: 'POST',
    }),

  pingServer: (id: string) =>
    apiFetch<{ success: boolean; data: { online: boolean; motd?: string; onlinePlayers?: number; maxPlayers?: number; version?: string } }>(
      `/servers/${encodeURIComponent(id)}/ping`,
      { method: 'POST' },
    ),

  attachProcess: (id: string, pid: number) =>
    apiFetch<{ success: boolean; state: string }>(`/servers/${encodeURIComponent(id)}/attach`, {
      method: 'POST',
      body: JSON.stringify({ pid }),
    }),

  detachProcess: (id: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/detach`, {
      method: 'POST',
    }),

  listJavaProcesses: () =>
    apiFetch<{ success: boolean; data: Array<{ pid: number; command: string }> }>('/servers/java-processes'),

  // ── SSH ──

  sshConnect: (id: string) =>
    apiFetch<{ success: boolean; sessionId: string }>(`/servers/${encodeURIComponent(id)}/ssh/connect`, {
      method: 'POST',
    }),

  sshDisconnect: (id: string, sessionId?: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/ssh/disconnect${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`, {
      method: 'DELETE',
    }),

  sshTest: (id: string) =>
    apiFetch<{ success: boolean; message: string }>(`/servers/${encodeURIComponent(id)}/ssh/test`, {
      method: 'POST',
    }),

  sshStatus: (id: string) =>
    apiFetch<SshStatusResponse>(`/servers/${encodeURIComponent(id)}/ssh/status`),

  sshSessions: (id: string) =>
    apiFetch<SshSessionsResponse>(`/servers/${encodeURIComponent(id)}/ssh/sessions`),

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

  // Legacy upload method - now returns taskId for async tracking
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

  // Convenience methods for specific async operations
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

  // ── Scheduled Stop / Restart ──

  scheduleStop: (id: string, stopAt: string, mode: 'graceful' | 'force' = 'graceful') =>
    apiFetch<{ success: boolean; stopAt: string; mode: string }>(`/servers/${encodeURIComponent(id)}/scheduled-stop`, {
      method: 'POST',
      body: JSON.stringify({ stopAt, mode }),
    }),

  scheduleRestart: (id: string, restartAt: string) =>
    apiFetch<{ success: boolean; restartAt: string }>(`/servers/${encodeURIComponent(id)}/scheduled-restart`, {
      method: 'POST',
      body: JSON.stringify({ restartAt }),
    }),

  getScheduledStop: (id: string) =>
    apiFetch<{ stopAt: string; mode: string } | null>(`/servers/${encodeURIComponent(id)}/scheduled-stop`),

  cancelScheduledStop: (id: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/scheduled-stop`, {
      method: 'DELETE',
    }),

  // ── Conditional Stop ──

  getConditionalStop: (id: string) =>
    apiFetch<ConditionalStopDto | null>(`/servers/${encodeURIComponent(id)}/conditional-stop`),

  setConditionalStop: (id: string, type: ConditionType, params: Record<string, number>) =>
    apiFetch<ConditionalStopDto>(`/servers/${encodeURIComponent(id)}/conditional-stop`, {
      method: 'PUT',
      body: JSON.stringify({ type, params }),
    }),

  clearConditionalStop: (id: string) =>
    apiFetch<{ success: boolean }>(`/servers/${encodeURIComponent(id)}/conditional-stop`, {
      method: 'DELETE',
    }),

  // ── Health Status ──

  getHealthStatus: (id: string) =>
    apiFetch<{ serverId: string; unresponsive: boolean; restartCount: number; monitoredServers: readonly string[] }>(
      `/servers/${encodeURIComponent(id)}/health`,
    ),

  // ── Start Templates ──

  listTemplates: () =>
    apiFetch<readonly StartTemplateDto[]>('/start-templates'),

  getTemplate: (templateId: string) =>
    apiFetch<StartTemplateDto>(`/start-templates/${encodeURIComponent(templateId)}`),

  createTemplate: (request: CreateStartTemplateDto) =>
    apiFetch<StartTemplateDto>('/start-templates', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updateTemplate: (templateId: string, request: UpdateStartTemplateDto) =>
    apiFetch<StartTemplateDto>(`/start-templates/${encodeURIComponent(templateId)}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    }),

  deleteTemplate: (templateId: string) =>
    apiFetch<void>(`/start-templates/${encodeURIComponent(templateId)}`, {
      method: 'DELETE',
    }),

  // ── Config Snapshots ──

  listSnapshots: (id: string) =>
    apiFetch<Array<{ id: string; name: string; createdAt: string; createdBy: string }>>(
      `/servers/${encodeURIComponent(id)}/snapshots`
    ),

  getSnapshot: (id: string, snapId: string) =>
    apiFetch<{ id: string; serverId: string; name: string; configJson: string; createdAt: string; createdBy: string }>(
      `/servers/${encodeURIComponent(id)}/snapshots/${encodeURIComponent(snapId)}`
    ),

  restoreSnapshot: (id: string, snapId: string) =>
    apiFetch<{ success: boolean }>(
      `/servers/${encodeURIComponent(id)}/snapshots/${encodeURIComponent(snapId)}/restore`,
      { method: 'POST' }
    ),
} as const;