import { create } from 'zustand';
import type { MetricSnapshotDto } from '@jian-agent/shared-domain';
import { apiFetch } from '../api/client.js';

interface RecentAlert {
  readonly level: string;
  readonly message: string;
  readonly timestamp: string;
}

interface AlertStats {
  readonly critical: number;
  readonly warning: number;
  readonly info: number;
  readonly recentAlerts: readonly RecentAlert[];
}

interface DashboardState {
  readonly metricHistory: readonly MetricSnapshotDto[];
  readonly serverStatus: {
    readonly state: string;
    readonly pid: number | null;
    readonly uptime: number;
  };
  readonly sessionStatus: {
    readonly state: string;
    readonly phase: string;
  };
  readonly botSummary: {
    readonly online: number;
    readonly total: number;
  };
  readonly alertStats: AlertStats;
  readonly loading: boolean;
}

interface DashboardActions {
  fetchInitialData: () => Promise<void>;
  pushMetricPoint: (point: MetricSnapshotDto) => void;
  updateServerStatus: (status: Partial<DashboardState['serverStatus']>) => void;
  updateSessionStatus: (status: Partial<DashboardState['sessionStatus']>) => void;
  updateBotSummary: (summary: Partial<DashboardState['botSummary']>) => void;
  updateAlertStats: (stats: Partial<AlertStats>) => void;
}

const MAX_HISTORY = 120;

export const useDashboardStore = create<DashboardState & DashboardActions>((set) => ({
  metricHistory: [],
  serverStatus: { state: 'STOPPED', pid: null, uptime: 0 },
  sessionStatus: { state: 'IDLE', phase: '' },
  botSummary: { online: 0, total: 0 },
  alertStats: { critical: 0, warning: 0, info: 0, recentAlerts: [] },
  loading: false,

  fetchInitialData: async () => {
    set({ loading: true });
    try {
      const [history, serverStatus, alertSummary] = await Promise.all([
        apiFetch<MetricSnapshotDto[]>('/metrics/history').catch(() => []),
        apiFetch<{ id: string; runtimeStatus: string; pid?: number; uptime?: number }[]>('/servers').then((list) => {
          if (!Array.isArray(list)) return { state: 'STOPPED', pid: undefined, uptime: undefined };
          const first = list[0];
          return first ? { state: first.runtimeStatus?.toUpperCase() ?? 'STOPPED', pid: first.pid, uptime: first.uptime } : { state: 'STOPPED', pid: undefined, uptime: undefined };
        }).catch(() => ({
          state: 'STOPPED',
          pid: undefined,
          uptime: undefined,
        })),
        apiFetch<{ critical: number; warning: number; info: number }>('/alerts/summary').catch(() => ({
          critical: 0,
          warning: 0,
          info: 0,
        })),
      ]);

      set({
        metricHistory: history,
        serverStatus: {
          state: serverStatus.state,
          pid: serverStatus.pid ?? null,
          uptime: serverStatus.uptime ?? 0,
        },
        alertStats: {
          ...alertSummary,
          recentAlerts: [],
        },
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  pushMetricPoint: (point) => {
    set((s) => ({
      metricHistory: [...s.metricHistory, point].slice(-MAX_HISTORY),
    }));
  },

  updateServerStatus: (status) => {
    set((s) => ({
      serverStatus: { ...s.serverStatus, ...status },
    }));
  },

  updateSessionStatus: (status) => {
    set((s) => ({
      sessionStatus: { ...s.sessionStatus, ...status },
    }));
  },

  updateBotSummary: (summary) => {
    set((s) => ({
      botSummary: { ...s.botSummary, ...summary },
    }));
  },

  updateAlertStats: (stats) => {
    set((s) => ({
      alertStats: { ...s.alertStats, ...stats },
    }));
  },
}));
