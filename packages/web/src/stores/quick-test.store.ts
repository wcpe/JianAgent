import { create } from 'zustand';
import { serverApi } from '../api/server.api.js';
import { botApi } from '../api/bot.api.js';

export type TestPhase = 'IDLE' | 'VALIDATING' | 'CREATING' | 'RUNNING' | 'STOPPING' | 'CLEANING' | 'DONE' | 'FAILED';

export interface TestConfig {
  readonly serverId: string;
  readonly botCount: number;
  readonly namePrefix: string;
  readonly behavior: string;
  readonly durationMinutes: number;
}

export interface TestRunRecord {
  readonly id: string;
  readonly serverId: string;
  readonly serverName: string;
  readonly botCount: number;
  readonly behavior: string;
  readonly duration: number;
  readonly result: 'success' | 'error' | 'aborted';
  readonly errorMessage?: string;
  readonly startedAt: string;
  readonly endedAt: string;
}

const HISTORY_KEY = 'jian-agent-quick-test-history';
const MAX_HISTORY = 10;

interface QuickTestState {
  phase: TestPhase;
  config: TestConfig | null;
  batchId: string | null;
  createdNames: readonly string[];
  startTime: number | null;
  errorMessage: string | null;
  history: TestRunRecord[];

  startTest: (config: TestConfig, serverName: string) => Promise<void>;
  endTest: () => Promise<void>;
  forceCleanup: () => Promise<void>;
  reset: () => void;
  loadHistory: () => void;
}

export const useQuickTestStore = create<QuickTestState>((set, get) => ({
  phase: 'IDLE',
  config: null,
  batchId: null,
  createdNames: [],
  startTime: null,
  errorMessage: null,
  history: [],

  startTest: async (config, serverName) => {
    set({ phase: 'VALIDATING', config, errorMessage: null, batchId: null, createdNames: [], startTime: null });

    try {
      const server = await serverApi.getServer(config.serverId);
      if (server.runtimeStatus !== 'running') {
        set({ phase: 'FAILED', errorMessage: `服务器未运行 (${server.runtimeStatus ?? 'unknown'})` });
        return;
      }

      set({ phase: 'CREATING' });
      const result = await botApi.createBatch({
        serverId: config.serverId,
        namePrefix: config.namePrefix,
        count: config.botCount,
        behavior: config.behavior,
      });
      set({ batchId: result.data.batchId, createdNames: Array.isArray(result.data?.createdNames) ? result.data.createdNames : [] });

      set({ phase: 'RUNNING', startTime: Date.now() });

      if (config.durationMinutes > 0) {
        setTimeout(() => {
          if (get().phase === 'RUNNING') {
            get().endTest();
          }
        }, config.durationMinutes * 60 * 1000);
      }
    } catch (err: unknown) {
      set({ phase: 'FAILED', errorMessage: err instanceof Error ? err.message : '测试启动失败' });
    }
  },

  endTest: async () => {
    const { batchId, config, startTime, phase } = get();
    if (phase !== 'RUNNING') return;

    try {
      set({ phase: 'STOPPING' });
      if (batchId) {
        await botApi.stopBatch(batchId);
      }

      set({ phase: 'CLEANING' });
      set({ phase: 'DONE' });

      const record: TestRunRecord = {
        id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        serverId: config!.serverId,
        serverName: '',
        botCount: config!.botCount,
        behavior: config!.behavior,
        duration: Math.floor((Date.now() - (startTime ?? Date.now())) / 1000),
        result: 'success',
        startedAt: new Date(startTime!).toISOString(),
        endedAt: new Date().toISOString(),
      };
      const history = [record, ...get().history].slice(0, MAX_HISTORY);
      set({ history });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (err: unknown) {
      set({ phase: 'FAILED', errorMessage: `停止失败: ${err instanceof Error ? err.message : String(err)}` });
    }
  },

  forceCleanup: async () => {
    const { batchId } = get();
    try {
      if (batchId) {
        await botApi.stopBatch(batchId);
      }
    } catch (err: unknown) { console.warn('Quick test cleanup failed:', err); }
    set({ phase: 'IDLE', batchId: null, createdNames: [], startTime: null, errorMessage: null });
  },

  reset: () => {
    set({ phase: 'IDLE', config: null, batchId: null, createdNames: [], startTime: null, errorMessage: null });
  },

  loadHistory: () => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) set({ history: JSON.parse(raw) });
    } catch (err: unknown) { console.warn('Failed to load quick test history:', err); }
  },
}));
