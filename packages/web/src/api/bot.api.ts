import type { BotScript } from '@jian-agent/shared-protocol';
import { apiFetch } from './client.js';

export interface BotSnapshot {
  readonly name: string;
  readonly state: string;
  readonly currentBehavior: string;
  readonly workerPid: number;
  readonly serverId?: string;
  readonly batchId?: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly health: number;
  readonly food: number;
  readonly latencyMs: number;
  readonly world: string;
  readonly isDead: boolean;
  readonly deathCount: number;
  readonly connectedAt: string | null;
  readonly lastError: string | null;
  readonly lastHeartbeat: number;
}

export interface BotStats {
  readonly total: number;
  readonly online: number;
  readonly offline: number;
  readonly error: number;
}

export interface BotListResult {
  readonly success: boolean;
  readonly data: BotSnapshot[];
  readonly meta: { total: number; page: number; limit: number };
}

export interface CreateBotBatchDto {
  readonly serverId: string;
  readonly namePrefix: string;
  readonly count: number;
  readonly behavior?: string;
  readonly autoRespawn?: boolean;
}

export interface SavedBotConfig {
  readonly id: string;
  readonly serverId: string;
  readonly namePrefix: string;
  readonly count: number;
  readonly behavior: string;
  readonly autoCreate: boolean;
  readonly rejoinStrategy: string;
  readonly maxRetries: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BotInventoryItem {
  readonly slot: number;
  readonly name: string;
  readonly displayName: string;
  readonly count: number;
  readonly maxDurability: number | null;
  readonly durabilityUsed: number | null;
}

export interface BotNearbyEntity {
  readonly id: number;
  readonly type: string;
  readonly name: string | null;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly distance: number;
  readonly health: number | null;
}

export interface BotTerrainBlock {
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly name: string;
}

export interface BatchBotResult {
  readonly name: string;
  readonly success: boolean;
}

export const botApi = {
  list: (params?: { serverId?: string; status?: string; search?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.serverId) q.set('serverId', params.serverId);
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return apiFetch<BotListResult>(`/bots${qs ? `?${qs}` : ''}`);
  },

  stats: (serverId?: string) => {
    const qs = serverId ? `?serverId=${encodeURIComponent(serverId)}` : '';
    return apiFetch<{ success: boolean; data: BotStats }>(`/bots/stats${qs}`);
  },

  getOne: (name: string) =>
    apiFetch<{ success: boolean; data: BotSnapshot }>(`/bots/${encodeURIComponent(name)}`),

  getDetail: (name: string) =>
    apiFetch<{ success: boolean; data: { inventory: BotInventoryItem[]; nearbyEntities: BotNearbyEntity[]; terrain: BotTerrainBlock[] } }>(`/bots/${encodeURIComponent(name)}/detail`),

  createBatch: (dto: CreateBotBatchDto) =>
    apiFetch<{ success: boolean; data: { batchId: string; createdNames: string[]; serverId: string; behavior: string } }>('/bots/create', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  setBehavior: (botName: string, behavior: string, params?: Record<string, unknown>) =>
    apiFetch<{ success: boolean }>('/bots/behavior', {
      method: 'POST',
      body: JSON.stringify({ botName, behavior, params }),
    }),

  stopBatch: (batchId: string) =>
    apiFetch<{ success: boolean }>('/bots/stop-batch', {
      method: 'POST',
      body: JSON.stringify({ batchId }),
    }),

  stopAll: () =>
    apiFetch<{ success: boolean }>('/bots/stop-all', { method: 'POST' }),

  stop: (name: string) =>
    apiFetch<{ success: boolean }>(`/bots/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  debugStart: (name: string) =>
    apiFetch<{ success: boolean }>(`/bots/${encodeURIComponent(name)}/debug/start`, { method: 'POST' }),

  debugCommand: (name: string, command: string) =>
    apiFetch<{ success: boolean }>(`/bots/${encodeURIComponent(name)}/debug/command`, {
      method: 'POST',
      body: JSON.stringify({ command }),
    }),

  debugStop: (name: string) =>
    apiFetch<{ success: boolean }>(`/bots/${encodeURIComponent(name)}/debug/stop`, { method: 'POST' }),

  respawn: (name: string) =>
    apiFetch<{ success: boolean }>(`/bots/${encodeURIComponent(name)}/respawn`, { method: 'POST' }),

  batchRespawn: (botNames: string[]) =>
    apiFetch<{ success: boolean; data: Array<{ name: string; success: boolean }> }>('/bots/batch-respawn', {
      method: 'POST',
      body: JSON.stringify({ botNames }),
    }),

  // Batch operations
  batchBehavior: (botNames: string[], behavior: string, params?: Record<string, unknown>) =>
    apiFetch<{ success: boolean; data: Array<{ name: string; success: boolean }> }>('/bots/batch-behavior', {
      method: 'POST',
      body: JSON.stringify({ botNames, behavior, params }),
    }),

  batchStop: (botNames: string[]) =>
    apiFetch<{ success: boolean }>('/bots/batch-stop', {
      method: 'POST',
      body: JSON.stringify({ botNames }),
    }),

  batchReconnect: (botNames: string[]) =>
    apiFetch<{ success: boolean; data: Array<{ name: string; success: boolean }> }>('/bots/batch-reconnect', {
      method: 'POST',
      body: JSON.stringify({ botNames }),
    }),

  batchDelete: (botNames: string[]) =>
    apiFetch<{ success: boolean }>('/bots/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ botNames }),
    }),

  batchExecuteScript: (botNames: string[], script: BotScript) =>
    apiFetch<{ success: boolean; data: BatchBotResult[] }>('/bots/batch-script', {
      method: 'POST',
      body: JSON.stringify({ botNames, script }),
    }),

  // Saved configs
  listSavedConfigs: (serverId?: string) => {
    const qs = serverId ? `?serverId=${encodeURIComponent(serverId)}` : '';
    return apiFetch<{ success: boolean; data: SavedBotConfig[] }>(`/bots/saved-configs${qs}`);
  },

  createSavedConfig: (dto: Omit<SavedBotConfig, 'id' | 'createdAt' | 'updatedAt'>) =>
    apiFetch<{ success: boolean; data: SavedBotConfig }>('/bots/saved-configs', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  updateSavedConfig: (id: string, patch: Partial<Omit<SavedBotConfig, 'id' | 'createdAt' | 'updatedAt'>>) =>
    apiFetch<{ success: boolean }>(`/bots/saved-configs/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  deleteSavedConfig: (id: string) =>
    apiFetch<{ success: boolean }>(`/bots/saved-configs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
} as const;
