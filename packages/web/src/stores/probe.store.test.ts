import { describe, it, expect } from 'vitest';
import { useProbeStore } from './probe.store.js';

describe('probeStore', () => {
  it('should have default state', () => {
    const state = useProbeStore.getState();
    expect(state.connections).toEqual([]);
    expect(state.snapshots.size).toBe(0);
    expect(state.selectedServerId).toBeNull();
    expect(state.loading).toBe(false);
  });

  it('should select server', () => {
    useProbeStore.getState().selectServer('srv-1');
    expect(useProbeStore.getState().selectedServerId).toBe('srv-1');
  });

  it('should push snapshot', () => {
    const snapshot = {
      tps: 20.0, mspt: 12.5, onlinePlayers: 5, maxPlayers: 100,
      loadedChunks: 100, entityCount: 200, worldCount: 1,
      freeMemoryMb: 1024, totalMemoryMb: 2048, uptime: '00:10:00',
      timestamp: '2026-01-01T00:00:00Z',
    };
    useProbeStore.getState().pushSnapshot('srv-1', snapshot);
    expect(useProbeStore.getState().snapshots.get('srv-1')).toBeDefined();
    expect(useProbeStore.getState().snapshots.get('srv-1')!.tps).toBe(20.0);
  });
});
