import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProcessOrchestratorService } from '../process-orchestrator.service.js';
import { ServerState } from '@jian-agent/shared-domain';

describe('ProcessOrchestratorService', () => {
  let service: ProcessOrchestratorService;
  let mockEventBus: { emit: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> };
  let mockProcessManager: { getState: ReturnType<typeof vi.fn> };
  let mockCrashRestart: {
    setStartCallback: ReturnType<typeof vi.fn>;
    handleCrash: ReturnType<typeof vi.fn>;
    resetCount: ReturnType<typeof vi.fn>;
  };
  let mockScheduledStop: { schedule: ReturnType<typeof vi.fn> };
  let mockConditionalStop: { setStopCallback: ReturnType<typeof vi.fn> };
  let mockHealthMonitor: { setEventCallback: ReturnType<typeof vi.fn>; startMonitoring: ReturnType<typeof vi.fn>; stopMonitoring: ReturnType<typeof vi.fn>; onModuleInit?: ReturnType<typeof vi.fn> };
  let mockConfigService: { getById: ReturnType<typeof vi.fn> };
  let mockLifecycleEngine: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  };
  let mockSnapshotService: { getAllLatest: ReturnType<typeof vi.fn> };
  let mockAlertEngine: { checkServerState: ReturnType<typeof vi.fn>; evaluateSnapshot: ReturnType<typeof vi.fn> };
  let setIntervalSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    mockEventBus = {
      emit: vi.fn(),
      on: vi.fn(),
    };
    mockProcessManager = {
      getState: vi.fn(),
    };
    mockCrashRestart = {
      setStartCallback: vi.fn(),
      handleCrash: vi.fn(),
      resetCount: vi.fn(),
    };
    mockScheduledStop = {
      schedule: vi.fn(),
    };
    mockConditionalStop = {
      setStopCallback: vi.fn(),
    };
    mockHealthMonitor = {
      setEventCallback: vi.fn(),
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
    };
    mockConfigService = {
      getById: vi.fn(),
    };
    mockLifecycleEngine = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    };
    mockSnapshotService = {
      getAllLatest: vi.fn().mockReturnValue([]),
    };
    mockAlertEngine = {
      checkServerState: vi.fn(),
      evaluateSnapshot: vi.fn().mockResolvedValue(undefined),
    };

    service = new ProcessOrchestratorService(
      mockEventBus as any,
      mockProcessManager as any,
      mockCrashRestart as any,
      mockScheduledStop as any,
      mockConditionalStop as any,
      mockHealthMonitor as any,
      mockConfigService as any,
      mockLifecycleEngine as any,
      mockSnapshotService as any,
      mockAlertEngine as any,
    );

    setIntervalSpy = vi.spyOn(global, 'setInterval').mockReturnValue({} as unknown as NodeJS.Timeout);
  });

  afterEach(() => {
    setIntervalSpy?.mockRestore();
  });

  it('should wire crash restart callback to lifecycle start', async () => {
    const config = { id: 'srv-1', jarPath: '/tmp/server.jar', workDir: '/tmp' };
    let crashStartCallback: ((serverId: string) => Promise<void>) | null = null;
    mockCrashRestart.setStartCallback.mockImplementation((cb) => {
      crashStartCallback = cb;
    });

    mockConfigService.getById.mockResolvedValue(config as any);
    service.onModuleInit();

    expect(mockCrashRestart.setStartCallback).toHaveBeenCalled();
    expect(crashStartCallback).toBeTruthy();

    await crashStartCallback?.('srv-1');

    expect(mockLifecycleEngine.start).toHaveBeenCalledWith(
      'srv-1',
      config,
      expect.objectContaining({ idempotencyKey: 'crash-restart:srv-1' }),
    );
  });

  it('should not start lifecycle when crash restart config is missing', async () => {
    let crashStartCallback: ((serverId: string) => Promise<void>) | null = null;
    mockCrashRestart.setStartCallback.mockImplementation((cb) => {
      crashStartCallback = cb;
    });

    mockConfigService.getById.mockResolvedValue(null);
    service.onModuleInit();

    await crashStartCallback?.('srv-1');
    expect(mockLifecycleEngine.start).not.toHaveBeenCalled();
  });

  it('should wire conditional stop callback to graceful lifecycle stop with idempotency key', async () => {
    let stopCallback: ((serverId: string, reason: string) => void) | null = null;
    mockConditionalStop.setStopCallback.mockImplementation((cb) => {
      stopCallback = cb;
    });
    service.onModuleInit();

    expect(mockConditionalStop.setStopCallback).toHaveBeenCalled();
    expect(stopCallback).toBeTruthy();
    await stopCallback?.('srv-1', 'oom');

    expect(mockLifecycleEngine.stop).toHaveBeenCalledWith(
      'srv-1',
      false,
      expect.objectContaining({
        idempotencyKey: 'conditional-stop:srv-1:oom',
      }),
    );
  });

  it('should wire health callback and emit recovered event', async () => {
    let healthCallback: ((event: any) => void) | null = null;
    mockHealthMonitor.setEventCallback.mockImplementation((cb) => {
      healthCallback = cb;
    });

    service.onModuleInit();

    expect(mockHealthMonitor.setEventCallback).toHaveBeenCalled();
    expect(healthCallback).toBeTruthy();
    await healthCallback?.({
      type: 'recovered',
      serverId: 'srv-1',
      detail: 'back-online',
    });

    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'server.health',
      expect.objectContaining({
        serverId: 'srv-1',
        type: 'recovered',
        detail: 'back-online',
      }),
    );
  });

  it('should handle server crashed event with missing config by only clearing monitor and checking state', async () => {
    mockConfigService.getById.mockResolvedValue(null);

    await service.onServerCrashed({ serverId: 'srv-1', exitCode: 1 });

    expect(mockAlertEngine.checkServerState).toHaveBeenCalledWith(ServerState.CRASHED);
    expect(mockHealthMonitor.stopMonitoring).toHaveBeenCalledWith('srv-1');
    expect(mockConfigService.getById).toHaveBeenCalledWith('srv-1');
    expect(mockCrashRestart.handleCrash).not.toHaveBeenCalled();
  });

  it('should delegate crash handling to CrashRestartService when config exists', async () => {
    const config = {
      id: 'srv-1',
      autoRestart: true,
      maxRestarts: 3,
      jarPath: '/tmp/server.jar',
      workDir: '/tmp',
    };
    const restartResult = { willRestart: true, attempt: 1, delay: 1000 };
    mockConfigService.getById.mockResolvedValue(config as any);
    mockCrashRestart.handleCrash.mockResolvedValue(restartResult as any);

    await service.onServerCrashed({ serverId: 'srv-1', exitCode: 7 });

    expect(mockCrashRestart.handleCrash).toHaveBeenCalledWith(
      'srv-1',
      7,
      true,
      3,
    );
  });

  it('should start health monitor when server becomes RUNNING', () => {
    service.onServerStateChanged({ serverId: 'srv-1', oldState: ServerState.STOPPED, newState: ServerState.RUNNING, pid: 12345 });

    expect(mockHealthMonitor.startMonitoring).toHaveBeenCalledWith('srv-1', 12345);
    expect(mockHealthMonitor.stopMonitoring).not.toHaveBeenCalled();
  });

  it('should stop health monitor when server stops or crashes', () => {
    service.onServerStateChanged({ serverId: 'srv-1', oldState: ServerState.RUNNING, newState: ServerState.STOPPED, pid: undefined });
    service.onServerStateChanged({ serverId: 'srv-2', oldState: ServerState.RUNNING, newState: ServerState.CRASHED, pid: undefined });

    expect(mockHealthMonitor.stopMonitoring).toHaveBeenCalledWith('srv-1');
    expect(mockHealthMonitor.stopMonitoring).toHaveBeenCalledWith('srv-2');
  });

  it('should reset crash count after running stable for 60 seconds', () => {
    vi.useFakeTimers();
    mockProcessManager.getState.mockReturnValue(ServerState.RUNNING);

    service.onServerStateChanged({ serverId: 'srv-1', oldState: ServerState.STARTING, newState: ServerState.RUNNING, pid: 12345 });

    vi.advanceTimersByTime(60_000);
    expect(mockCrashRestart.resetCount).toHaveBeenCalledWith('srv-1');
    vi.useRealTimers();
  });

  it('should stop then start on scheduled restart stop with execution id', async () => {
    const config = { id: 'srv-1', jarPath: '/tmp/server.jar', workDir: '/tmp' };
    mockConfigService.getById.mockResolvedValue(config as any);
    const executionId = 'srv-1::scheduled-restart::graceful::1710000000000::idem-1';

    await service.onScheduledRestartStop({ serverId: 'srv-1', executionId });

    expect(mockLifecycleEngine.stop).toHaveBeenCalledWith(
      'srv-1',
      false,
      expect.objectContaining({ idempotencyKey: `${executionId}::stop` }),
    );
    expect(mockLifecycleEngine.start).toHaveBeenCalledWith(
      'srv-1',
      config,
      expect.objectContaining({ idempotencyKey: `${executionId}::start` }),
    );
  });

  it('should continue scheduled restart and skip start when config is missing', async () => {
    mockConfigService.getById.mockResolvedValue(null);
    const executionId = 'srv-1::scheduled-restart::graceful::1710000000000::idem-2';

    await service.onScheduledRestartStop({ serverId: 'srv-1', executionId });

    expect(mockLifecycleEngine.stop).toHaveBeenCalledWith(
      'srv-1',
      false,
      expect.objectContaining({ idempotencyKey: `${executionId}::stop` }),
    );
    expect(mockLifecycleEngine.start).not.toHaveBeenCalled();
  });

  it('should keep restart flow even if stop fails first', async () => {
    const config = { id: 'srv-1', jarPath: '/tmp/server.jar', workDir: '/tmp' };
    mockConfigService.getById.mockResolvedValue(config as any);
    mockLifecycleEngine.stop.mockRejectedValueOnce(new Error('stop failed'));
    const executionId = 'srv-1::scheduled-restart::force::1710000000000::idem-3';

    await service.onScheduledRestartStop({ serverId: 'srv-1', executionId });

    expect(mockLifecycleEngine.stop).toHaveBeenCalledWith(
      'srv-1',
      false,
      expect.objectContaining({ idempotencyKey: `${executionId}::stop` }),
    );
    expect(mockLifecycleEngine.start).toHaveBeenCalledWith(
      'srv-1',
      config,
      expect.objectContaining({ idempotencyKey: `${executionId}::start` }),
    );
  });

  it('should forward graceful stop event with operation idempotency key', async () => {
    await service.onGracefulStopRequested({
      serverId: 'srv-1',
      executionId: 'graceful-stop-idem-1',
    });

    expect(mockLifecycleEngine.stop).toHaveBeenCalledWith(
      'srv-1',
      false,
      expect.objectContaining({ idempotencyKey: 'graceful-stop-idem-1' }),
    );
  });

  it('should forward force stop event with operation idempotency key', async () => {
    await service.onForceStopRequested({
      serverId: 'srv-1',
      executionId: 'force-stop-idem-1',
    });

    expect(mockLifecycleEngine.stop).toHaveBeenCalledWith(
      'srv-1',
      true,
      expect.objectContaining({ idempotencyKey: 'force-stop-idem-1' }),
    );
  });
});
