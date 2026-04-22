/**
 * useFileTasks — File task subscription hook
 *
 * Subscribes to WebSocket file task events and syncs them into the store.
 * Also provides convenience methods for task operations.
 */

import { useEffect, useCallback } from 'react';
import { useWsChannel } from '../../ws/use-ws-channel.js';
import { WsChannel } from '@jian-agent/shared-protocol';
import { useFileTaskStore, type FileTaskItem } from './file-task.store.js';
import { serverApi } from '../../api/server.api.js';
import { useDialogStore } from '../../stores/dialog.store.js';
import type { FileTaskDto } from '@jian-agent/shared-domain';

// ── WS event interfaces (matching server event-bus definitions) ──

interface FileTaskCreatedEvent {
  readonly taskId: string;
  readonly serverId: string;
  readonly kind: string;
  readonly sourcePaths: readonly string[];
  readonly timestamp: number;
}

interface FileTaskStateChangedEvent {
  readonly taskId: string;
  readonly serverId: string;
  readonly kind: string;
  readonly oldState: string;
  readonly newState: string;
  readonly progress?: number;
  readonly error?: string;
  readonly errorDetail?: string;
  readonly resultArtifact?: string;
  readonly timestamp: number;
}

function dtoToItem(dto: FileTaskDto, message = ''): FileTaskItem {
  return {
    taskId: dto.taskId,
    serverId: dto.serverId,
    kind: dto.kind,
    state: dto.state as FileTaskItem['state'],
    progress: dto.progress,
    message: message || stateToMessage(dto.state, dto.kind),
    error: dto.error,
    resultArtifact: dto.resultArtifact,
    sourcePaths: dto.sourcePaths,
    createdAt: Date.now(),
    completedAt: isTerminalState(dto.state) ? Date.now() : null,
  };
}

function stateToMessage(state: string, kind: string): string {
  const kindLabels: Record<string, string> = {
    UPLOAD: '上传',
    PACK_DOWNLOAD: '打包下载',
    DIR_COPY: '目录复制',
    DIR_MOVE: '目录移动',
    COMPRESS: '压缩',
    DECOMPRESS: '解压',
    REMOTE_DOWNLOAD: '远程下载',
  };
  const label = kindLabels[kind] ?? kind;
  switch (state) {
    case 'PENDING': return `${label} 等待中`;
    case 'RUNNING': return `${label} 执行中`;
    case 'COMPLETED': return `${label} 完成`;
    case 'FAILED': return `${label} 失败`;
    case 'CANCELLED': return `${label} 已取消`;
    default: return label;
  }
}

function isTerminalState(state: string): boolean {
  return state === 'COMPLETED' || state === 'FAILED' || state === 'CANCELLED';
}

/**
 * Hook to subscribe to file task WS events for a specific server.
 * Call this once per visible server tab to keep task state in sync.
 */
export function useFileTasks(serverId: string) {
  const { upsertTask, getServerTasks, getActiveCount, clearCompletedTasks } = useFileTaskStore();
  const showToast = useDialogStore((s) => s.showToast);

  // ── WS: Task Created ──
  const handleCreated = useCallback(
    (payload: FileTaskCreatedEvent) => {
      if (payload.serverId !== serverId) return;
      upsertTask({
        taskId: payload.taskId,
        serverId: payload.serverId,
        kind: payload.kind as FileTaskItem['kind'],
        state: 'PENDING',
        progress: 0,
        message: stateToMessage('PENDING', payload.kind),
        error: null,
        resultArtifact: null,
        sourcePaths: payload.sourcePaths,
        createdAt: payload.timestamp,
        completedAt: null,
      });
    },
    [serverId, upsertTask],
  );

  // ── WS: State Changed ──
  const handleStateChanged = useCallback(
    (payload: FileTaskStateChangedEvent) => {
      if (payload.serverId !== serverId) return;
      const isTerminal = isTerminalState(payload.newState);
      const item: FileTaskItem = {
        taskId: payload.taskId,
        serverId: payload.serverId,
        kind: payload.kind as FileTaskItem['kind'],
        state: payload.newState as FileTaskItem['state'],
        progress: payload.progress ?? (isTerminal ? 100 : 0),
        message: payload.errorDetail || stateToMessage(payload.newState, payload.kind),
        error: payload.error ?? null,
        resultArtifact: payload.resultArtifact ?? null,
        sourcePaths: [],
        createdAt: payload.timestamp,
        completedAt: isTerminal ? payload.timestamp : null,
      };
      upsertTask(item);

      // Toast notifications
      if (payload.newState === 'COMPLETED') {
        showToast('文件任务完成', 'success');
      } else if (payload.newState === 'FAILED') {
        showToast(`文件任务失败: ${payload.errorDetail || '未知错误'}`, 'error');
      }
    },
    [serverId, upsertTask, showToast],
  );

  useWsChannel(WsChannel.TASK_FILE_TASK_CREATED, handleCreated);
  useWsChannel(WsChannel.TASK_FILE_TASK_STATE_CHANGED, handleStateChanged);

  // ── Actions ──

  const loadTasks = useCallback(async () => {
    try {
      const tasks = await serverApi.listFileTasks(serverId);
      for (const dto of tasks) {
        upsertTask(dtoToItem(dto));
      }
    } catch {
      // Silently fail — tasks will populate from WS events
    }
  }, [serverId, upsertTask]);

  const cancelTask = useCallback(
    async (taskId: string) => {
      try {
        await serverApi.cancelFileTask(serverId, taskId);
        useFileTaskStore.getState().cancelTask(serverId, taskId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '取消失败';
        showToast(msg, 'error');
      }
    },
    [serverId, showToast],
  );

  const downloadArtifact = useCallback(
    async (taskId: string) => {
      try {
        const res = await serverApi.downloadTaskArtifact(serverId, taskId);
        const bytes = Uint8Array.from(atob(res.data), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`下载完成：${res.filename}`, 'success');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '下载失败';
        showToast(msg, 'error');
      }
    },
    [serverId, showToast],
  );

  const clearCompleted = useCallback(() => {
    clearCompletedTasks(serverId);
  }, [serverId, clearCompletedTasks]);

  // Load existing tasks on mount
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  return {
    tasks: getServerTasks(serverId),
    activeCount: getActiveCount(serverId),
    loadTasks,
    cancelTask,
    downloadArtifact,
    clearCompleted,
  };
}
