import { create } from 'zustand';
import type { ProbeSnapshotDto } from '@jian-agent/shared-domain';
import type { ConnectionInfo, SnapshotResponse } from '../api/probe.api.js';
import { probeApi } from '../api/probe.api.js';

export interface ProbeResultEntry {
  readonly requestId: string;
  readonly success: boolean;
  readonly message: string;
  readonly timestamp: string;
}

interface ProbeState {
  readonly connections: readonly ConnectionInfo[];
  readonly snapshots: ReadonlyMap<string, ProbeSnapshotDto>;
  readonly selectedServerId: string | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly consoleResults: readonly ProbeResultEntry[];
  readonly evalResults: readonly ProbeResultEntry[];
}

interface ProbeActions {
  fetchConnections: () => Promise<void>;
  fetchSnapshots: () => Promise<void>;
  selectServer: (serverId: string) => void;
  pushSnapshot: (serverId: string, snapshot: ProbeSnapshotDto) => void;
  pushConsoleResult: (entry: ProbeResultEntry) => void;
  pushEvalResult: (entry: ProbeResultEntry) => void;
  clearConsoleResults: () => void;
  clearEvalResults: () => void;
}

export const useProbeStore = create<ProbeState & ProbeActions>((set, get) => ({
  connections: [],
  snapshots: new Map(),
  selectedServerId: null,
  loading: false,
  error: null,
  consoleResults: [],
  evalResults: [],

  fetchConnections: async () => {
    set({ loading: true, error: null });
    try {
      const connections = await probeApi.listConnections();
      set({ connections, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  fetchSnapshots: async () => {
    try {
      const responses = await probeApi.getAllSnapshots();
      if (!Array.isArray(responses)) return;
      const snapshots = new Map(
        responses.map((r: SnapshotResponse) => [r.serverId, r.snapshot]),
      );
      set({ snapshots });
    } catch {
      // silent — realtime updates will fill in
    }
  },

  selectServer: (serverId) => set({ selectedServerId: serverId }),

  pushSnapshot: (serverId, snapshot) => {
    const prev = get().snapshots;
    const next = new Map(prev);
    next.set(serverId, snapshot);
    set({ snapshots: next });
  },

  pushConsoleResult: (entry) => {
    const prev = get().consoleResults;
    set({ consoleResults: [...prev.slice(-99), entry] });
  },

  pushEvalResult: (entry) => {
    const prev = get().evalResults;
    set({ evalResults: [...prev.slice(-99), entry] });
  },

  clearConsoleResults: () => set({ consoleResults: [] }),
  clearEvalResults: () => set({ evalResults: [] }),
}));
