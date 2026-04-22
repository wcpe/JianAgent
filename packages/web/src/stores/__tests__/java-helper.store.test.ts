import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useJavaHelperStore } from '../java-helper.store.js';

vi.mock('../../api/java-helper.api.js', () => ({
  javaHelperApi: {
    getStatus: vi.fn().mockResolvedValue({ success: true, data: { state: 'IDLE' } }),
  },
}));

describe('useJavaHelperStore', () => {
  beforeEach(() => {
    useJavaHelperStore.setState({
      status: null,
      lastThreadSample: null,
      lastHeapSample: null,
      loading: false,
      error: null,
    });
  });

  it('should have initial state', () => {
    const state = useJavaHelperStore.getState();
    expect(state.status).toBeNull();
    expect(state.loading).toBe(false);
  });

  it('should fetch status', async () => {
    await useJavaHelperStore.getState().fetchStatus();
    const state = useJavaHelperStore.getState();
    expect(state.status).toEqual({ state: 'IDLE' });
    expect(state.loading).toBe(false);
  });

  it('should set thread sample', () => {
    const sample = { threadCount: 5, threads: [], sampledAt: '2024-01-01' };
    useJavaHelperStore.getState().setThreadSample(sample);
    expect(useJavaHelperStore.getState().lastThreadSample).toEqual(sample);
  });
});
