/**
 * Plugin Operation Store
 *
 * Tracks recent plugin operations and their results for display as banners.
 * Operations are keyed by serverId:requestId and auto-expire after a timeout.
 */

import { create } from 'zustand';
import type { PluginOperationType } from '@jian-agent/shared-domain';

export interface PluginOperationEntry {
  readonly requestId: string;
  readonly serverId: string;
  readonly pluginName: string;
  readonly operation: PluginOperationType;
  readonly success: boolean;
  readonly hasConnection: boolean;
  readonly message: string;
  readonly timestamp: number;
}

interface PluginOperationState {
  /** Recent operation results keyed by requestId */
  readonly entries: Record<string, PluginOperationEntry>;
  /** Max entries to keep before pruning */
  readonly maxEntries: number;
}

interface PluginOperationActions {
  /** Record a completed operation result */
  recordOperation: (entry: Omit<PluginOperationEntry, 'timestamp'>) => void;
  /** Dismiss a specific banner by requestId */
  dismiss: (requestId: string) => void;
  /** Dismiss all banners for a server */
  dismissAll: (serverId: string) => void;
  /** Get recent entries for a server, newest first */
  getServerEntries: (serverId: string) => PluginOperationEntry[];
}

const MAX_ENTRIES = 20;
const AUTO_EXPIRE_MS = 15_000; // 15 seconds

export const usePluginOperationStore = create<PluginOperationState & PluginOperationActions>((set, get) => ({
  entries: {},
  maxEntries: MAX_ENTRIES,

  recordOperation: (entry) => {
    const full: PluginOperationEntry = { ...entry, timestamp: Date.now() };
    set((s) => {
      const next = { ...s.entries, [entry.requestId]: full };
      // Prune oldest if over limit
      const keys = Object.keys(next);
      if (keys.length > MAX_ENTRIES) {
        const sorted = keys.sort((a, b) => next[b].timestamp - next[a].timestamp);
        for (let i = MAX_ENTRIES; i < sorted.length; i++) {
          delete next[sorted[i]];
        }
      }
      return { entries: next };
    });

    // Auto-expire
    setTimeout(() => {
      set((s) => {
        if (!s.entries[entry.requestId]) return s;
        const next = { ...s.entries };
        delete next[entry.requestId];
        return { entries: next };
      });
    }, AUTO_EXPIRE_MS);
  },

  dismiss: (requestId) => {
    set((s) => {
      if (!s.entries[requestId]) return s;
      const next = { ...s.entries };
      delete next[requestId];
      return { entries: next };
    });
  },

  dismissAll: (serverId) => {
    set((s) => {
      const next = { ...s.entries };
      let changed = false;
      for (const [key, entry] of Object.entries(next)) {
        if (entry.serverId === serverId) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? { entries: next } : s;
    });
  },

  getServerEntries: (serverId) => {
    return Object.values(get().entries)
      .filter((e) => e.serverId === serverId)
      .sort((a, b) => b.timestamp - a.timestamp);
  },
}));
