import { describe, it, expect, beforeEach } from 'vitest';
import { SnapshotService } from '../snapshot.service.js';
import type { ProbeSnapshotDto } from '@jian-agent/shared-domain';
import type { MetricStoreService } from '../../storage/metric-store.service.js';

const mockMetricStore: MetricStoreService = {
  insert: async () => {},
  queryRange: async () => [],
  getLatest: async () => undefined,
} as unknown as MetricStoreService;

describe('SnapshotService', () => {
  let service: SnapshotService;

  const mockSnapshot: ProbeSnapshotDto = {
    tps: 20.0,
    mspt: 12.5,
    onlinePlayers: 10,
    maxPlayers: 100,
    loadedChunks: 256,
    entityCount: 500,
    worldCount: 3,
    freeMemoryMb: 2048,
    totalMemoryMb: 4096,
    uptime: '01:30:00',
    timestamp: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    service = new SnapshotService(mockMetricStore);
  });

  it('should store and retrieve latest snapshot', () => {
    service.onSnapshot('srv-1', mockSnapshot, {
      runtimeKind: 'paper-1.21+',
      capabilityMatrix: ['players', 'plugins'],
    });
    const stored = service.getLatest('srv-1');
    expect(stored).toBeDefined();
    expect(stored!.snapshot.tps).toBe(20.0);
    expect(stored!.snapshot.runtimeKind).toBe('paper-1.21+');
    expect(stored!.snapshot.capabilityMatrix).toContain('players');
  });

  it('should overwrite with latest snapshot', () => {
    service.onSnapshot('srv-1', mockSnapshot);
    service.onSnapshot('srv-1', { ...mockSnapshot, tps: 18.0 });
    const stored = service.getLatest('srv-1');
    expect(stored!.snapshot.tps).toBe(18.0);
  });

  it('should return undefined for unknown server', () => {
    expect(service.getLatest('unknown')).toBeUndefined();
  });

  it('should list all latest snapshots', () => {
    service.onSnapshot('srv-1', mockSnapshot);
    service.onSnapshot('srv-2', { ...mockSnapshot, tps: 19.5 });
    expect(service.getAllLatest()).toHaveLength(2);
  });
});
