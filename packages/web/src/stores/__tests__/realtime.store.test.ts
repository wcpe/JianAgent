import { describe, it, expect, beforeEach } from 'vitest';
import { useRealtimeStore } from '../realtime.store.js';

beforeEach(() => {
  useRealtimeStore.setState({
    activeServerId: null,
    metricSummary: null,
    detailEvents: [],
    connected: false,
  });
});

describe('useRealtimeStore', () => {
  it('setActiveServer resets events and summary', () => {
    useRealtimeStore.setState({
      activeServerId: 'old',
      metricSummary: { serverId: 'old' } as any,
      detailEvents: [{ type: 'x' }] as any,
    });

    useRealtimeStore.getState().setActiveServer('new');

    const state = useRealtimeStore.getState();
    expect(state.activeServerId).toBe('new');
    expect(state.metricSummary).toBeNull();
    expect(state.detailEvents).toEqual([]);
  });

  it('updateMetricSummary only accepts matching serverId', () => {
    useRealtimeStore.setState({ activeServerId: 'srv-1' });

    useRealtimeStore.getState().updateMetricSummary({ serverId: 'srv-2', tps: 20 } as any);
    expect(useRealtimeStore.getState().metricSummary).toBeNull();

    useRealtimeStore.getState().updateMetricSummary({ serverId: 'srv-1', tps: 19.5 } as any);
    expect(useRealtimeStore.getState().metricSummary).toEqual({ serverId: 'srv-1', tps: 19.5 });
  });

  it('pushDetailEvent prepends and caps at 200', () => {
    const initial = Array.from({ length: 200 }, (_, i) => ({ id: i }));
    useRealtimeStore.setState({ detailEvents: initial as any });

    useRealtimeStore.getState().pushDetailEvent({ id: 999 } as any);

    const events = useRealtimeStore.getState().detailEvents;
    expect(events).toHaveLength(200);
    expect(events[0]).toEqual({ id: 999 }); // newest first
    expect(events[199]).toEqual({ id: 198 }); // last original dropped
  });

  it('clearEvents empties the list', () => {
    useRealtimeStore.setState({ detailEvents: [{ id: 1 }] as any });
    useRealtimeStore.getState().clearEvents();
    expect(useRealtimeStore.getState().detailEvents).toEqual([]);
  });

  it('setConnected updates state', () => {
    useRealtimeStore.getState().setConnected(true);
    expect(useRealtimeStore.getState().connected).toBe(true);
    useRealtimeStore.getState().setConnected(false);
    expect(useRealtimeStore.getState().connected).toBe(false);
  });
});
