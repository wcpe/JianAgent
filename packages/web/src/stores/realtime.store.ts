import { create } from 'zustand';
import type { MetricSummaryDto, DetailEventDto } from '@jian-agent/shared-domain';

interface RealtimeState {
  readonly activeServerId: string | null;
  readonly metricSummary: MetricSummaryDto | null;
  readonly detailEvents: readonly DetailEventDto[];
  readonly connected: boolean;

  setActiveServer: (id: string) => void;
  updateMetricSummary: (summary: MetricSummaryDto) => void;
  pushDetailEvent: (event: DetailEventDto) => void;
  clearEvents: () => void;
  setConnected: (connected: boolean) => void;
}

const MAX_DETAIL_EVENTS = 200;

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  activeServerId: null,
  metricSummary: null,
  detailEvents: [],
  connected: false,

  setActiveServer: (id: string) =>
    set({ activeServerId: id, metricSummary: null, detailEvents: [] }),

  updateMetricSummary: (summary: MetricSummaryDto) => {
    const { activeServerId } = get();
    if (summary.serverId === activeServerId) {
      set({ metricSummary: summary });
    }
  },

  pushDetailEvent: (event: DetailEventDto) => {
    set((state) => {
      const events = [event, ...state.detailEvents].slice(0, MAX_DETAIL_EVENTS);
      return { detailEvents: events };
    });
  },

  clearEvents: () => set({ detailEvents: [] }),

  setConnected: (connected: boolean) => set({ connected }),
}));
