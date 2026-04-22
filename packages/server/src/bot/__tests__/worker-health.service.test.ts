import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerHealthService } from '../worker-health.service.js';
import { WorkerRegistryService } from '../worker-registry.service.js';
import type { RegisterWorkerDto } from '@jian-agent/shared-domain';

const makeWorker = (id: string): RegisterWorkerDto => ({
  workerId: id,
  hostname: 'localhost',
  port: 3000,
  maxCapacity: 100,
  currentLoad: 0,
  tags: [],
});

describe('WorkerHealthService', () => {
  let registry: WorkerRegistryService;
  let healthService: WorkerHealthService;

  beforeEach(() => {
    registry = new WorkerRegistryService();
    healthService = new WorkerHealthService(registry);
  });

  afterEach(() => {
    healthService.onModuleDestroy();
  });

  it('should not change status of recently registered worker', () => {
    registry.register(makeWorker('w1'));
    healthService.checkAll();
    expect(registry.getWorker('w1')?.status).toBe('online');
  });

  it('should mark worker unhealthy after heartbeat timeout', () => {
    const worker = registry.register(makeWorker('w1'));
    // Simulate stale heartbeat by directly setting lastHeartbeat in the past
    const staleWorker = { ...worker, lastHeartbeat: Date.now() - 35_000 };
    (registry as any).workers.set('w1', staleWorker);

    healthService.checkAll();
    expect(registry.getWorker('w1')?.status).toBe('unhealthy');
  });

  it('should mark worker offline after extended timeout', () => {
    const worker = registry.register(makeWorker('w1'));
    const staleWorker = { ...worker, lastHeartbeat: Date.now() - 100_000 };
    (registry as any).workers.set('w1', staleWorker);

    healthService.checkAll();
    expect(registry.getWorker('w1')?.status).toBe('offline');
  });

  it('should skip already offline workers', () => {
    registry.register(makeWorker('w1'));
    registry.markOffline('w1');
    const markOfflineSpy = vi.spyOn(registry, 'markOffline');

    healthService.checkAll();
    // Should not call markOffline again since it's already offline
    expect(markOfflineSpy).not.toHaveBeenCalled();
  });
});
