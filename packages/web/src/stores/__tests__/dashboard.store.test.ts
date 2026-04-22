import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDashboardStore } from '../dashboard.store.js';

vi.mock('../../api/client.js', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../../api/client.js';

const mockedFetch = vi.mocked(apiFetch);

beforeEach(() => {
  useDashboardStore.setState({
    metricHistory: [],
    serverStatus: { state: 'STOPPED', pid: null, uptime: 0 },
    sessionStatus: { state: 'IDLE', phase: '' },
    botSummary: { online: 0, total: 0 },
    alertStats: { critical: 0, warning: 0, info: 0, recentAlerts: [] },
    loading: false,
  });
  vi.clearAllMocks();
});

describe('useDashboardStore', () => {
  it('fetchInitialData populates state on success', async () => {
    const history = [{ ts: 1, tps: 20 }];
    const servers = [{ id: 's1', runtimeStatus: 'running', pid: 123, uptime: 60 }];
    const alertSummary = { critical: 1, warning: 2, info: 3 };

    mockedFetch
      .mockResolvedValueOnce(history as any) // /metrics/history
      .mockResolvedValueOnce(servers as any) // /servers
      .mockResolvedValueOnce(alertSummary as any); // /alerts/summary

    await useDashboardStore.getState().fetchInitialData();

    const state = useDashboardStore.getState();
    expect(state.metricHistory).toEqual(history);
    expect(state.serverStatus.state).toBe('RUNNING');
    expect(state.serverStatus.pid).toBe(123);
    expect(state.alertStats.critical).toBe(1);
    expect(state.loading).toBe(false);
  });

  it('fetchInitialData handles API failures gracefully', async () => {
    mockedFetch
      .mockRejectedValueOnce(new Error('fail')) // /metrics/history
      .mockRejectedValueOnce(new Error('fail')) // /servers
      .mockRejectedValueOnce(new Error('fail')); // /alerts/summary

    await useDashboardStore.getState().fetchInitialData();

    const state = useDashboardStore.getState();
    expect(state.metricHistory).toEqual([]);
    expect(state.serverStatus.state).toBe('STOPPED');
    expect(state.loading).toBe(false);
  });

  it('pushMetricPoint appends and caps at 120', () => {
    const initial = Array.from({ length: 120 }, (_, i) => ({ ts: i }));
    useDashboardStore.setState({ metricHistory: initial as any });

    useDashboardStore.getState().pushMetricPoint({ ts: 999 } as any);

    const hist = useDashboardStore.getState().metricHistory;
    expect(hist).toHaveLength(120);
    expect(hist[hist.length - 1]).toEqual({ ts: 999 });
    expect(hist[0]).toEqual({ ts: 1 }); // first dropped
  });

  it('updateServerStatus merges partial', () => {
    useDashboardStore.getState().updateServerStatus({ state: 'RUNNING' });
    expect(useDashboardStore.getState().serverStatus.state).toBe('RUNNING');
    expect(useDashboardStore.getState().serverStatus.pid).toBeNull(); // preserved
  });

  it('updateBotSummary merges partial', () => {
    useDashboardStore.getState().updateBotSummary({ online: 5 });
    expect(useDashboardStore.getState().botSummary.online).toBe(5);
    expect(useDashboardStore.getState().botSummary.total).toBe(0);
  });

  it('updateAlertStats merges partial', () => {
    useDashboardStore.getState().updateAlertStats({ critical: 3 });
    expect(useDashboardStore.getState().alertStats.critical).toBe(3);
    expect(useDashboardStore.getState().alertStats.warning).toBe(0);
  });
});
