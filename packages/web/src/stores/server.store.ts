import { create } from 'zustand';
import { serverApi } from '../api/server.api.js';
import type {
  ServerWithStatusDto,
  CreateServerConfigRequest,
  UpdateServerConfigRequest,
} from '@jian-agent/shared-domain';

interface ServerStoreState {
  servers: ServerWithStatusDto[];
  viewMode: 'card' | 'table';
  filter: { search: string; status: string | null };
  loading: boolean;
  error: string | null;

  setViewMode(mode: 'card' | 'table'): void;
  setFilter(filter: Partial<{ search: string; status: string | null }>): void;

  fetchServers(): Promise<void>;
  createServer(dto: CreateServerConfigRequest): Promise<void>;
  updateServer(id: string, dto: UpdateServerConfigRequest): Promise<void>;
  deleteServer(id: string): Promise<void>;
  startServer(id: string): Promise<void>;
  stopServer(id: string): Promise<void>;
  interruptServer(id: string): Promise<void>;
  restartServer(id: string): Promise<void>;
  attachProcess(id: string, pid: number): Promise<void>;
  detachProcess(id: string): Promise<void>;

  patchServerStatus(serverId: string, patch: Partial<ServerWithStatusDto>): void;
}

export const useServerStore = create<ServerStoreState>((set, get) => ({
  servers: [],
  viewMode: 'card',
  filter: { search: '', status: null },
  loading: false,
  error: null,

  setViewMode: (mode) => set({ viewMode: mode }),
  setFilter: (filter) =>
    set((s) => ({ filter: { ...s.filter, ...filter } })),

  fetchServers: async () => {
    set({ loading: true, error: null });
    try {
      const servers = await serverApi.listServers();
      set({ servers: [...servers], loading: false });
    } catch (err: any) {
      set({ error: err.message ?? 'Failed to fetch servers', loading: false });
    }
  },

  createServer: async (dto) => {
    await serverApi.createServer(dto);
    await get().fetchServers();
  },

  updateServer: async (id, dto) => {
    await serverApi.updateServer(id, dto);
    await get().fetchServers();
  },

  deleteServer: async (id) => {
    await serverApi.deleteServer(id);
    set((s) => ({ servers: s.servers.filter((sv) => sv.id !== id) }));
  },

  startServer: async (id) => {
    await serverApi.startServer(id);
    await get().fetchServers();
  },

  stopServer: async (id) => {
    await serverApi.stopServer(id);
    await get().fetchServers();
  },

  interruptServer: async (id) => {
    await serverApi.interruptServer(id);
    await get().fetchServers();
  },

  restartServer: async (id) => {
    await serverApi.restartServer(id);
    await get().fetchServers();
  },

  attachProcess: async (id, pid) => {
    await serverApi.attachProcess(id, pid);
    await get().fetchServers();
  },

  detachProcess: async (id) => {
    await serverApi.detachProcess(id);
    await get().fetchServers();
  },

  patchServerStatus: (serverId, patch) =>
    set((s) => ({
      servers: s.servers.map((sv) =>
        sv.id === serverId ? { ...sv, ...patch } : sv,
      ),
    })),
}));
