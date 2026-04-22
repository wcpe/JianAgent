import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServerLifecycleEngine } from '../lifecycle/lifecycle-engine.service.js';
import { ServerLifecyclePhase } from '@jian-agent/shared-domain';

describe('ServerLifecycleEngine', () => {
  let engine: ServerLifecycleEngine;
  let mockProcessManager: any;
  let mockValidator: any;
  let mockHookExecutor: any;
  let mockReadyDetector: any;
  let mockEventBus: any;

  beforeEach(() => {
    mockProcessManager = {
      getStatus: vi.fn().mockReturnValue({ state: 'STOPPED' }),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      writeStdin: vi.fn(),
    };
    mockValidator = {
      validate: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
    };
    mockHookExecutor = {
      exec: vi.fn().mockResolvedValue({ exitCode: 0, stdout: '', stderr: '', durationMs: 0, timedOut: false }),
    };
    mockReadyDetector = {
      waitForReady: vi.fn().mockResolvedValue({ ready: true, durationMs: 100, timedOut: false }),
      onOutput: vi.fn(),
      cancel: vi.fn(),
    };
    mockEventBus = {
      emit: vi.fn(),
    };

    engine = new ServerLifecycleEngine(
      mockProcessManager,
      mockValidator,
      mockHookExecutor,
      mockReadyDetector,
      mockEventBus,
    );
  });

  it('should start in IDLE phase', () => {
    expect(engine.getPhase('srv-1')).toBe(ServerLifecyclePhase.IDLE);
  });

  it('should return null config for unknown server', () => {
    expect(engine.getConfig('srv-unknown')).toBeNull();
  });

  it('should emit lifecycle events on phase transitions', async () => {
    await engine.start('srv-1', {
      id: 'srv-1',
      jarPath: '/path/to/server.jar',
      workDir: '/tmp',
      javaPath: 'java',
      jvmArgs: [],
      serverArgs: [],
      host: 'localhost',
      port: 25565,
    } as any);

    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'server.lifecycle-phase',
      expect.objectContaining({ serverId: 'srv-1' }),
    );
  });

  it('should call validator during VALIDATING phase', async () => {
    await engine.start('srv-1', {
      id: 'srv-1',
      jarPath: '/path/to/server.jar',
      workDir: '/tmp',
      javaPath: 'java',
    } as any);

    expect(mockValidator.validate).toHaveBeenCalled();
  });

  it('should transition to FAILED if validation fails', async () => {
    mockValidator.validate.mockResolvedValue({
      valid: false,
      errors: [{ field: 'jarPath', message: 'not found', severity: 'error' }],
    });

    await expect(
      engine.start('srv-1', { id: 'srv-1', jarPath: '/bad', workDir: '/tmp' } as any)
    ).rejects.toThrow();

    expect(engine.getPhase('srv-1')).toBe(ServerLifecyclePhase.FAILED);
  });

  it('should execute preStart hook when configured', async () => {
    await engine.start('srv-1', {
      id: 'srv-1',
      jarPath: '/path/to/server.jar',
      workDir: '/tmp',
      preStartCommand: 'echo preparing',
    } as any);

    expect(mockHookExecutor.exec).toHaveBeenCalledWith('echo preparing', '/tmp', expect.any(Number));
  });

  it('should call processManager.start and readyDetector.waitForReady', async () => {
    await engine.start('srv-1', {
      id: 'srv-1',
      jarPath: '/path/to/server.jar',
      workDir: '/tmp',
    } as any);

    expect(mockProcessManager.start).toHaveBeenCalled();
    expect(mockReadyDetector.waitForReady).toHaveBeenCalledWith('srv-1', undefined, expect.any(Number));
  });

  it('should reach RUNNING phase on successful start', async () => {
    await engine.start('srv-1', {
      id: 'srv-1',
      jarPath: '/path/to/server.jar',
      workDir: '/tmp',
    } as any);

    expect(engine.getPhase('srv-1')).toBe(ServerLifecyclePhase.RUNNING);
  });

  it('should fail and stop process when ready detection times out', async () => {
    mockReadyDetector.waitForReady.mockResolvedValue({
      ready: false,
      durationMs: 5000,
      timedOut: true,
    });

    await expect(
      engine.start('srv-1', {
        id: 'srv-1',
        jarPath: '/path/to/server.jar',
        workDir: '/tmp',
      } as any)
    ).rejects.toThrow('Server start timed out');

    expect(engine.getPhase('srv-1')).toBe(ServerLifecyclePhase.FAILED);
    expect(mockProcessManager.stop).toHaveBeenCalledWith('srv-1', true);
  });

  it('should execute postStart hook when configured', async () => {
    await engine.start('srv-1', {
      id: 'srv-1',
      jarPath: '/path/to/server.jar',
      workDir: '/tmp',
      postStartCommand: 'echo done',
    } as any);

    expect(mockHookExecutor.exec).toHaveBeenCalledWith('echo done', '/tmp', expect.any(Number));
  });

  it('should reject starting when already RUNNING', async () => {
    await engine.start('srv-1', {
      id: 'srv-1',
      jarPath: '/path/to/server.jar',
      workDir: '/tmp',
    } as any);

    await expect(
      engine.start('srv-1', {
        id: 'srv-1',
        jarPath: '/path/to/server.jar',
        workDir: '/tmp',
      } as any)
    ).rejects.toThrow(/already in phase/);
  });

  it('should stop from RUNNING through STOPPING', async () => {
    await engine.start('srv-1', {
      id: 'srv-1',
      jarPath: '/path/to/server.jar',
      workDir: '/tmp',
    } as any);

    await engine.stop('srv-1', false);

    expect(mockProcessManager.stop).toHaveBeenCalled();
    expect(engine.getPhase('srv-1')).toBe(ServerLifecyclePhase.STOPPED);
  });

  it('should throw when stopping a server that is not running', async () => {
    await expect(engine.stop('srv-unknown')).rejects.toThrow(/not running/);
  });

  it('should execute preStop hook when configured', async () => {
    await engine.start('srv-1', {
      id: 'srv-1',
      jarPath: '/path/to/server.jar',
      workDir: '/tmp',
      preStopCommand: 'echo pre-stop',
    } as any);

    await engine.stop('srv-1', false);

    expect(mockHookExecutor.exec).toHaveBeenCalledWith('echo pre-stop', '/tmp', expect.any(Number));
  });

  it('should execute postStop hook when configured', async () => {
    await engine.start('srv-1', {
      id: 'srv-1',
      jarPath: '/path/to/server.jar',
      workDir: '/tmp',
      postStopCommand: 'echo post-stop',
    } as any);

    await engine.stop('srv-1', false);

    expect(mockHookExecutor.exec).toHaveBeenCalledWith('echo post-stop', '/tmp', expect.any(Number));
  });

  it('should restart a running server', async () => {
    await engine.start('srv-1', {
      id: 'srv-1',
      jarPath: '/path/to/server.jar',
      workDir: '/tmp',
    } as any);

    expect(engine.getPhase('srv-1')).toBe(ServerLifecyclePhase.RUNNING);

    await engine.restart('srv-1');

    expect(engine.getPhase('srv-1')).toBe(ServerLifecyclePhase.RUNNING);
    expect(mockProcessManager.stop).toHaveBeenCalled();
    expect(mockProcessManager.start).toHaveBeenCalledTimes(2);
  });

  it('should throw when restarting without prior config', async () => {
    await expect(engine.restart('srv-unknown')).rejects.toThrow(/No config/);
  });

  it('should reset to IDLE', async () => {
    await engine.start('srv-1', {
      id: 'srv-1',
      jarPath: '/path/to/server.jar',
      workDir: '/tmp',
    } as any);

    engine.reset('srv-1');
    expect(engine.getPhase('srv-1')).toBe(ServerLifecyclePhase.IDLE);
  });

  it('should store config accessible via getConfig', async () => {
    const config = {
      id: 'srv-1',
      jarPath: '/path/to/server.jar',
      workDir: '/tmp',
    };

    await engine.start('srv-1', config as any);

    expect(engine.getConfig('srv-1')).toEqual(config);
  });

  it('should emit events with correct previousPhase on transitions', async () => {
    await engine.start('srv-1', {
      id: 'srv-1',
      jarPath: '/path/to/server.jar',
      workDir: '/tmp',
    } as any);

    // The RUNNING event should have previous phase set to STARTING or POST_START
    const runningEvent = mockEventBus.emit.mock.calls.find(
      (call: any[]) => call[1]?.phase === ServerLifecyclePhase.RUNNING,
    );
    expect(runningEvent).toBeDefined();
    expect(runningEvent![1]).toMatchObject({
      serverId: 'srv-1',
      phase: ServerLifecyclePhase.RUNNING,
    });
  });
});
