import { describe, it, expect, beforeEach } from 'vitest';
import { WorkerRegistryService } from '../worker-registry.service.js';
import type { RegisterWorkerDto } from '@jian-agent/shared-domain';

const makeWorker = (id: string, capacity = 100, load = 0): RegisterWorkerDto => ({
  workerId: id,
  hostname: 'localhost',
  port: 3000 + parseInt(id.replace('w', ''), 10),
  maxCapacity: capacity,
  currentLoad: load,
  tags: ['test'],
});

describe('WorkerRegistryService', () => {
  let service: WorkerRegistryService;

  beforeEach(() => {
    service = new WorkerRegistryService();
  });

  it('should register a worker and return it with online status', () => {
    const result = service.register(makeWorker('w1'));
    expect(result.status).toBe('online');
    expect(result.workerId).toBe('w1');
    expect(service.size).toBe(1);
  });

  it('should deregister a worker', () => {
    service.register(makeWorker('w1'));
    expect(service.deregister('w1')).toBe(true);
    expect(service.size).toBe(0);
    expect(service.deregister('nonexistent')).toBe(false);
  });

  it('should update load on heartbeat', () => {
    service.register(makeWorker('w1'));
    expect(service.heartbeat('w1', 42)).toBe(true);
    const worker = service.getWorker('w1');
    expect(worker?.currentLoad).toBe(42);
  });

  it('should return false for unknown worker heartbeat', () => {
    expect(service.heartbeat('unknown', 10)).toBe(false);
  });

  it('should filter workers by status', () => {
    service.register(makeWorker('w1'));
    service.register(makeWorker('w2'));
    service.markUnhealthy('w2');

    const online = service.listWorkers({ status: 'online' });
    expect(online).toHaveLength(1);
    expect(online[0]!.workerId).toBe('w1');

    const unhealthy = service.listWorkers({ status: 'unhealthy' });
    expect(unhealthy).toHaveLength(1);
    expect(unhealthy[0]!.workerId).toBe('w2');
  });

  it('should return available workers sorted by capacity', () => {
    service.register(makeWorker('w1', 100, 80)); // 20 remaining
    service.register(makeWorker('w2', 100, 10)); // 90 remaining
    service.register(makeWorker('w3', 50, 50));  // 0 remaining — full

    const available = service.getAvailableWorkers();
    expect(available).toHaveLength(2);
    expect(available[0]!.workerId).toBe('w2'); // most remaining capacity first
  });

  it('should mark worker offline', () => {
    service.register(makeWorker('w1'));
    service.markOffline('w1');
    expect(service.getWorker('w1')?.status).toBe('offline');
  });
});
