import { create } from 'zustand';
import { botApi, type BotSnapshot, type BotStats, type CreateBotBatchDto } from '../api/bot.api.js';

interface BotStoreState {
  readonly bots: readonly BotSnapshot[];
  readonly stats: BotStats | null;
  readonly meta: { total: number; page: number; limit: number } | null;
  readonly selectedBotName: string | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly filter: { serverId?: string; status?: string; search?: string; page: number; limit: number };

  fetchBots: () => Promise<void>;
  fetchStats: (serverId?: string) => Promise<void>;
  setFilter: (patch: Partial<BotStoreState['filter']>) => void;
  selectBot: (name: string | null) => void;
  createBatch: (dto: CreateBotBatchDto) => Promise<{ batchId: string }>;
  stopBot: (name: string) => Promise<void>;
  stopBatch: (batchId: string) => Promise<void>;
  stopAll: () => Promise<void>;
}

export const useBotStore = create<BotStoreState>((set, get) => ({
  bots: [],
  stats: null,
  meta: null,
  selectedBotName: null,
  loading: false,
  error: null,
  filter: { page: 1, limit: 200 },

  fetchBots: async () => {
    const isInitial = get().bots.length === 0 && !get().meta;
    if (isInitial) set({ loading: true, error: null });
    try {
      const { filter } = get();
      const res = await botApi.list(filter);
      set({ bots: Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []), meta: res.meta, loading: false, error: null });
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Failed to fetch bots', loading: false });
    }
  },

  fetchStats: async (serverId) => {
    try {
      const res = await botApi.stats(serverId);
      set({ stats: res.data });
    } catch {
      /* stats are non-critical */
    }
  },

  setFilter: (patch) => {
    const { filter } = get();
    set({ filter: { ...filter, ...patch } });
  },

  selectBot: (name) => set({ selectedBotName: name }),

  createBatch: async (dto) => {
    const res = await botApi.createBatch(dto);
    await get().fetchBots();
    await get().fetchStats(dto.serverId);
    return { batchId: res.data.batchId };
  },

  stopBot: async (name) => {
    await botApi.stop(name);
    await get().fetchBots();
  },

  stopBatch: async (batchId) => {
    await botApi.stopBatch(batchId);
    await get().fetchBots();
  },

  stopAll: async () => {
    await botApi.stopAll();
    await get().fetchBots();
  },
}));
