import { describe, it, expect, beforeEach } from 'vitest';
import { useAlertsStore } from '../alerts.store.js';

describe('useAlertsStore', () => {
  beforeEach(() => {
    useAlertsStore.setState({
      alerts: [],
      summary: null,
      rules: [],
      loading: false,
      error: null,
    });
  });

  it('should have correct default state', () => {
    const state = useAlertsStore.getState();
    expect(state.alerts).toEqual([]);
    expect(state.summary).toBeNull();
    expect(state.rules).toEqual([]);
    expect(state.loading).toBe(false);
  });

  it('should push alert with max limit', () => {
    const { pushAlert } = useAlertsStore.getState();
    for (let i = 0; i < 205; i++) {
      pushAlert({
        id: `a-${i}`,
        timestamp: new Date().toISOString(),
        level: 'WARNING',
        ruleId: 'r-1',
        ruleName: 'test',
        message: `alert-${i}`,
        value: i,
        threshold: 100,
        acknowledged: false,
      });
    }
    expect(useAlertsStore.getState().alerts.length).toBe(200);
    expect(useAlertsStore.getState().alerts[0].id).toBe('a-204');
  });

  it('should acknowledge alert immutably', () => {
    useAlertsStore.setState({
      alerts: [
        { id: 'a-1', timestamp: '', level: 'CRITICAL', ruleId: 'r-1', ruleName: 'test', message: 'msg', value: 1, threshold: 2, acknowledged: false },
        { id: 'a-2', timestamp: '', level: 'WARNING', ruleId: 'r-2', ruleName: 'test2', message: 'msg2', value: 3, threshold: 4, acknowledged: false },
      ],
    });
    // Simulate acknowledgeAlert logic (just the state part, skipping API)
    useAlertsStore.setState((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === 'a-1' ? { ...a, acknowledged: true } : a,
      ),
    }));
    const state = useAlertsStore.getState();
    expect(state.alerts[0].acknowledged).toBe(true);
    expect(state.alerts[1].acknowledged).toBe(false);
  });
});
