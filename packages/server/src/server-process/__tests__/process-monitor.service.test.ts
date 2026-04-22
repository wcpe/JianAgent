import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcessMonitorService } from '../process-monitor.service.js';
import { ServerState, DEFAULTS } from '@jian-agent/shared-domain';

describe('ProcessMonitorService', () => {
  const fakeStatuses = {
    'srv-1': { state: ServerState.RUNNING, pid: 101, uptime: 1000, restartCount: 0 },
    'srv-2': { state: ServerState.STARTING, pid: 202, uptime: 500, restartCount: 1 },
  };

  const createProcessManager = () => ({
    getManagedServerIds: vi.fn(() => ['srv-1', 'srv-2']),
    getStatus: vi.fn((serverId: string) => fakeStatuses[serverId as keyof typeof fakeStatuses]),
  });

  const createEventBus = () => ({
    emit: vi.fn(),
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('polls every managed server and emits monitor tick with serverId context', () => {
    const processManager = createProcessManager();
    const eventBus = createEventBus();
    const service = new ProcessMonitorService(processManager as any, eventBus as any);

    service.onModuleInit();
    vi.advanceTimersByTime(DEFAULTS.MONITOR_INTERVAL_MS);

    expect(processManager.getManagedServerIds).toHaveBeenCalledTimes(1);
    expect(processManager.getStatus).toHaveBeenCalledWith('srv-1');
    expect(processManager.getStatus).toHaveBeenCalledWith('srv-2');
    expect(eventBus.emit).toHaveBeenCalledWith('monitor-tick', {
      ...fakeStatuses['srv-1'],
      serverId: 'srv-1',
    });
    expect(eventBus.emit).toHaveBeenCalledWith('monitor-tick', {
      ...fakeStatuses['srv-2'],
      serverId: 'srv-2',
    });

    service.onModuleDestroy();
    vi.useRealTimers();
  });
});