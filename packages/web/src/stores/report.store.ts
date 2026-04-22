import { create } from 'zustand';
import { reportApi } from '../api/report.api.js';
import type { SessionReportDto } from '@jian-agent/shared-domain';

interface MetricTimeSeriesPoint {
  readonly timestamp: number;
  readonly value: number;
}

interface ReportState {
  readonly selectedSessionId: string | null;
  readonly report: SessionReportDto | null;
  readonly compareSessionIds: readonly string[];
  readonly metricSeries: Readonly<Record<string, readonly MetricTimeSeriesPoint[]>>;
  readonly loading: boolean;
  readonly error: string | null;
  selectSession: (sessionId: string) => Promise<void>;
  addCompareSession: (sessionId: string) => void;
  removeCompareSession: (sessionId: string) => void;
  clearCompare: () => void;
  fetchMetricSeries: (sessionId: string, metric: string) => Promise<void>;
}

export const useReportStore = create<ReportState>((set, get) => ({
  selectedSessionId: null,
  report: null,
  compareSessionIds: [],
  metricSeries: {},
  loading: false,
  error: null,

  selectSession: async (sessionId: string) => {
    set({ loading: true, error: null, selectedSessionId: sessionId });
    try {
      const report = await reportApi.getSessionReport(sessionId);
      set({ report, loading: false });
    } catch (err: any) {
      set({ loading: false, error: err.message ?? 'Failed to load report' });
    }
  },

  addCompareSession: (sessionId: string) => {
    const { compareSessionIds } = get();
    if (compareSessionIds.length >= 5) return;
    if (compareSessionIds.includes(sessionId)) return;
    set({ compareSessionIds: [...compareSessionIds, sessionId] });
  },

  removeCompareSession: (sessionId: string) => {
    const { compareSessionIds } = get();
    set({ compareSessionIds: compareSessionIds.filter((id) => id !== sessionId) });
  },

  clearCompare: () => set({ compareSessionIds: [] }),

  fetchMetricSeries: async (sessionId: string, metric: string) => {
    try {
      const data = await reportApi.getSessionMetrics(sessionId, metric);
      const key = `${sessionId}:${metric}`;
      set((state) => ({
        metricSeries: { ...state.metricSeries, [key]: data },
      }));
    } catch {
      // non-fatal, series stays empty
    }
  },
}));
