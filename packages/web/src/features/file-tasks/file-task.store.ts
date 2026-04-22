/**
 * File Task Store
 *
 * Zustand store for managing file operation tasks.
 * Tasks are keyed by serverId:taskId and track progress, state, errors.
 */

import { create } from 'zustand';
import type { FileTaskKind } from '@jian-agent/shared-domain';

export interface FileTaskItem {
  readonly taskId: string;
  readonly serverId: string;
  readonly kind: FileTaskKind;
  readonly state: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  readonly progress: number;
  readonly message: string;
  readonly error: string | null;
  readonly resultArtifact: string | null;
  readonly sourcePaths: readonly string[];
  readonly createdAt: number;
  readonly completedAt: number | null;
}

interface FileTaskState {
  /** Map of serverId → Map of taskId → task item */
  readonly tasksByServer: Record<string, Record<string, FileTaskItem>>;
  /** Whether the task panel is visible */
  readonly panelVisible: boolean;
}

interface FileTaskActions {
  /** Add or update a task */
  upsertTask: (task: FileTaskItem) => void;
  /** Remove a task */
  removeTask: (serverId: string, taskId: string) => void;
  /** Clear all tasks for a server */
  clearServerTasks: (serverId: string) => void;
  /** Clear completed/failed tasks for a server */
  clearCompletedTasks: (serverId: string) => void;
  /** Cancel a task (optimistic) */
  cancelTask: (serverId: string, taskId: string) => void;
  /** Toggle panel visibility */
  togglePanel: () => void;
  setPanelVisible: (visible: boolean) => void;
  /** Get tasks for a server */
  getServerTasks: (serverId: string) => FileTaskItem[];
  /** Get active (non-completed) task count for a server */
  getActiveCount: (serverId: string) => number;
}

export const useFileTaskStore = create<FileTaskState & FileTaskActions>((set, get) => ({
  tasksByServer: {},
  panelVisible: false,

  upsertTask: (task) => {
    set((s) => {
      const serverTasks = { ...(s.tasksByServer[task.serverId] ?? {}) };
      serverTasks[task.taskId] = task;
      return {
        tasksByServer: { ...s.tasksByServer, [task.serverId]: serverTasks },
      };
    });
  },

  removeTask: (serverId, taskId) => {
    set((s) => {
      const serverTasks = { ...(s.tasksByServer[serverId] ?? {}) };
      delete serverTasks[taskId];
      return {
        tasksByServer: { ...s.tasksByServer, [serverId]: serverTasks },
      };
    });
  },

  clearServerTasks: (serverId) => {
    set((s) => {
      const { [serverId]: _, ...rest } = s.tasksByServer;
      return { tasksByServer: rest };
    });
  },

  clearCompletedTasks: (serverId) => {
    set((s) => {
      const serverTasks = s.tasksByServer[serverId];
      if (!serverTasks) return s;
      const filtered: Record<string, FileTaskItem> = {};
      for (const [taskId, task] of Object.entries(serverTasks)) {
        if (task.state === 'PENDING' || task.state === 'RUNNING') {
          filtered[taskId] = task;
        }
      }
      return {
        tasksByServer: { ...s.tasksByServer, [serverId]: filtered },
      };
    });
  },

  cancelTask: (serverId, taskId) => {
    set((s) => {
      const serverTasks = s.tasksByServer[serverId];
      const task = serverTasks?.[taskId];
      if (!task) return s;
      return {
        tasksByServer: {
          ...s.tasksByServer,
          [serverId]: {
            ...serverTasks,
            [taskId]: {
              ...task,
              state: 'CANCELLED' as const,
              message: '已取消',
              completedAt: Date.now(),
            },
          },
        },
      };
    });
  },

  togglePanel: () => set((s) => ({ panelVisible: !s.panelVisible })),
  setPanelVisible: (visible) => set({ panelVisible: visible }),

  getServerTasks: (serverId) => {
    const serverTasks = get().tasksByServer[serverId];
    if (!serverTasks) return [];
    return Object.values(serverTasks).sort((a, b) => b.createdAt - a.createdAt);
  },

  getActiveCount: (serverId) => {
    const serverTasks = get().tasksByServer[serverId];
    if (!serverTasks) return 0;
    return Object.values(serverTasks).filter(
      (t) => t.state === 'PENDING' || t.state === 'RUNNING',
    ).length;
  },
}));
