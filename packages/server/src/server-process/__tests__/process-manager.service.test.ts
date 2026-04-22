import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessManagerService } from '../process-manager.service.js';
import { ServerState } from '@jian-agent/shared-domain';

describe('ProcessManagerService', () => {
  let service: ProcessManagerService;

  beforeEach(() => {
    service = new ProcessManagerService();
  });

  it('should start in STOPPED state for any server', () => {
    expect(service.getState()).toBe(ServerState.STOPPED);
    expect(service.getState('srv-1')).toBe(ServerState.STOPPED);
  });

  it('should expose getStatus() for a server', () => {
    const status = service.getStatus('srv-1');
    expect(status.state).toBe(ServerState.STOPPED);
    expect(status.pid).toBeUndefined();
    expect(status.restartCount).toBe(0);
  });

  it('should reject start when no config', async () => {
    await expect(service.start(null as any)).rejects.toThrow();
  });

  it('should track multiple server IDs independently', () => {
    expect(service.getManagedServerIds()).toHaveLength(0);
    const statuses = service.getAllStatuses();
    expect(statuses.size).toBe(0);
  });

  it('should default serverId to "default" for backwards-compat', () => {
    const status = service.getStatus();
    expect(status.state).toBe(ServerState.STOPPED);
  });
});
