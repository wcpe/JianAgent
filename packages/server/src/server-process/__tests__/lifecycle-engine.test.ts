import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    expect(mockReadyDetector.waitForReady).toHaveBeenCalledWith(
      'srv-1',
      undefined,
      expect.any(Number),
      expect.objectContaining({
        mode: 'hybrid',
        host: undefined,
        port: undefined,
        portCheckIntervalMs: 500,
        portCheckTimeoutMs: 20000,
      }),
    );
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
      } as any),
    ).resolves.toBeUndefined();

    expect(mockProcessManager.start).toHaveBeenCalledTimes(1);
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

  it('should noop when stopping unknown server', async () => {
    await expect(engine.stop('srv-unknown')).resolves.toBeUndefined();
    expect(mockProcessManager.stop).not.toHaveBeenCalled();
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

  describe('Retry Logic', () => {
    let retryEngine: ServerLifecycleEngine;
    let retryMockProcessManager: any;
    let retryMockValidator: any;
    let retryMockHookExecutor: any;
    let retryMockReadyDetector: any;
    let retryMockEventBus: any;

    beforeEach(() => {
      vi.useFakeTimers();

      retryMockProcessManager = {
        getStatus: vi.fn().mockReturnValue({ state: 'STOPPED' }),
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        writeStdin: vi.fn(),
      };
      retryMockValidator = {
        validate: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
      };
      retryMockHookExecutor = {
        exec: vi.fn().mockResolvedValue({ exitCode: 0, stdout: '', stderr: '', durationMs: 0, timedOut: false }),
      };
      retryMockReadyDetector = {
        waitForReady: vi.fn().mockResolvedValue({ ready: true, durationMs: 100, timedOut: false }),
        onOutput: vi.fn(),
        cancel: vi.fn(),
      };
      retryMockEventBus = {
        emit: vi.fn(),
      };

      retryEngine = new ServerLifecycleEngine(
        retryMockProcessManager,
        retryMockValidator,
        retryMockHookExecutor,
        retryMockReadyDetector,
        retryMockEventBus,
      );
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    });

    it('should succeed on first attempt without retry', async () => {
      const startPromise = retryEngine.start('srv-1', {
        id: 'srv-1',
        jarPath: '/path/to/server.jar',
        workDir: '/tmp',
      } as any);

      await vi.runAllTimersAsync();
      await startPromise;

      expect(retryMockProcessManager.start).toHaveBeenCalledTimes(1);
      expect(retryMockReadyDetector.waitForReady).toHaveBeenCalledTimes(1);
      expect(retryEngine.getPhase('srv-1')).toBe(ServerLifecyclePhase.RUNNING);
    });

    it('should retry on ready timeout', async () => {
      retryMockReadyDetector.waitForReady
        .mockResolvedValueOnce({ ready: false, timedOut: true, durationMs: 5000 })
        .mockResolvedValueOnce({ ready: true, durationMs: 100, timedOut: false });

      vi.stubEnv('START_RETRY_ATTEMPTS', '2');
      vi.stubEnv('START_RETRY_BASE_DELAY_MS', '500');

      const startPromise = retryEngine.start('srv-2', {
        id: 'srv-2',
        jarPath: '/path/to/server.jar',
        workDir: '/tmp',
      } as any);

      await vi.runAllTimersAsync();
      await startPromise;

      expect(retryMockProcessManager.start).toHaveBeenCalledTimes(2);
      expect(retryMockProcessManager.stop).toHaveBeenCalledTimes(1);
      expect(retryEngine.getPhase('srv-2')).toBe(ServerLifecyclePhase.RUNNING);
    });

    it('should fail after exhausting all retry attempts', async () => {
      retryMockReadyDetector.waitForReady.mockResolvedValue({
        ready: false,
        timedOut: true,
        durationMs: 5000,
      });

      vi.stubEnv('START_RETRY_ATTEMPTS', '3');
      vi.stubEnv('START_RETRY_BASE_DELAY_MS', '100');

      const startPromise = retryEngine.start('srv-3', {
        id: 'srv-3',
        jarPath: '/path/to/server.jar',
        workDir: '/tmp',
      } as any);

      await vi.runAllTimersAsync();

      await expect(startPromise).rejects.toThrow('Server start timed out');
      expect(retryMockProcessManager.start).toHaveBeenCalledTimes(3);
      expect(retryMockProcessManager.stop).toHaveBeenCalledTimes(3);
      expect(retryEngine.getPhase('srv-3')).toBe(ServerLifecyclePhase.FAILED);
    });

    it('should apply exponential backoff delays', async () => {
      retryMockReadyDetector.waitForReady
        .mockResolvedValueOnce({ ready: false, timedOut: true, durationMs: 5000 })
        .mockResolvedValueOnce({ ready: false, timedOut: true, durationMs: 5000 })
        .mockResolvedValueOnce({ ready: true, durationMs: 100, timedOut: false });

      vi.stubEnv('START_RETRY_ATTEMPTS', '3');
      vi.stubEnv('START_RETRY_BASE_DELAY_MS', '500');

      const startPromise = retryEngine.start('srv-4', {
        id: 'srv-4',
        jarPath: '/path/to/server.jar',
        workDir: '/tmp',
      } as any);

      await vi.runAllTimersAsync();
      await startPromise;

      expect(retryMockProcessManager.start).toHaveBeenCalledTimes(3);
      expect(retryEngine.getPhase('srv-4')).toBe(ServerLifecyclePhase.RUNNING);
    });

    it('should cap delay at maxDelayMs', async () => {
      retryMockReadyDetector.waitForReady
        .mockResolvedValueOnce({ ready: false, timedOut: true, durationMs: 5000 })
        .mockResolvedValueOnce({ ready: false, timedOut: true, durationMs: 5000 })
        .mockResolvedValueOnce({ ready: true, durationMs: 100, timedOut: false });

      vi.stubEnv('START_RETRY_ATTEMPTS', '3');
      vi.stubEnv('START_RETRY_BASE_DELAY_MS', '1000');
      vi.stubEnv('START_RETRY_MAX_DELAY_MS', '1500');

      const startPromise = retryEngine.start('srv-5', {
        id: 'srv-5',
        jarPath: '/path/to/server.jar',
        workDir: '/tmp',
      } as any);

      await vi.runAllTimersAsync();
      await startPromise;

      expect(retryEngine.getPhase('srv-5')).toBe(ServerLifecyclePhase.RUNNING);
    });

    it('should call stop() exactly once per failed attempt', async () => {
      const stopCalls: string[] = [];
      retryMockProcessManager.stop.mockImplementation(async () => {
        stopCalls.push('stop');
      });

      retryMockReadyDetector.waitForReady
        .mockResolvedValueOnce({ ready: false, timedOut: true, durationMs: 5000 })
        .mockResolvedValueOnce({ ready: false, timedOut: true, durationMs: 5000 })
        .mockResolvedValueOnce({ ready: true, durationMs: 100, timedOut: false });

      vi.stubEnv('START_RETRY_ATTEMPTS', '3');

      const startPromise = retryEngine.start('srv-6', {
        id: 'srv-6',
        jarPath: '/path/to/server.jar',
        workDir: '/tmp',
      } as any);

      await vi.runAllTimersAsync();
      await startPromise;

      expect(stopCalls.length).toBe(2);
    });

    it('should continue retry even if stop() fails', async () => {
      retryMockProcessManager.stop.mockRejectedValue(new Error('Stop failed'));

      retryMockReadyDetector.waitForReady
        .mockResolvedValueOnce({ ready: false, timedOut: true, durationMs: 5000 })
        .mockResolvedValueOnce({ ready: true, durationMs: 100, timedOut: false });

      vi.stubEnv('START_RETRY_ATTEMPTS', '2');

      const startPromise = retryEngine.start('srv-7', {
        id: 'srv-7',
        jarPath: '/path/to/server.jar',
        workDir: '/tmp',
      } as any);

      await vi.runAllTimersAsync();
      await startPromise;

      expect(retryEngine.getPhase('srv-7')).toBe(ServerLifecyclePhase.RUNNING);
    });

    it('should not call stop() on successful start', async () => {
      const startPromise = retryEngine.start('srv-8', {
        id: 'srv-8',
        jarPath: '/path/to/server.jar',
        workDir: '/tmp',
      } as any);

      await vi.runAllTimersAsync();
      await startPromise;

      expect(retryMockProcessManager.stop).not.toHaveBeenCalled();
      expect(retryEngine.getPhase('srv-8')).toBe(ServerLifecyclePhase.RUNNING);
    });

    it('should deduplicate concurrent requests with same idempotency key', async () => {
      const config = {
        id: 'srv-9',
        jarPath: '/path/to/server.jar',
        workDir: '/tmp',
      } as any;

      const promise1 = retryEngine.start('srv-9', config, { idempotencyKey: 'key-1' });
      const promise2 = retryEngine.start('srv-9', config, { idempotencyKey: 'key-1' });

      await vi.runAllTimersAsync();
      await Promise.all([promise1, promise2]);

      expect(retryMockProcessManager.start).toHaveBeenCalledTimes(1);
    });

    it('should allow different keys to run independently', async () => {
      const config1 = {
        id: 'srv-10',
        jarPath: '/path/to/server.jar',
        workDir: '/tmp',
      } as any;

      const config2 = {
        id: 'srv-11',
        jarPath: '/path/to/server.jar',
        workDir: '/tmp',
      } as any;

      const promise1 = retryEngine.start('srv-10', config1, { idempotencyKey: 'key-a' });
      const promise2 = retryEngine.start('srv-11', config2, { idempotencyKey: 'key-b' });

      await vi.runAllTimersAsync();
      await Promise.all([promise1, promise2]);

      expect(retryMockProcessManager.start).toHaveBeenCalledTimes(2);
    });

    it('should emit STARTING phase for each retry with attempt number', async () => {
      retryMockReadyDetector.waitForReady
        .mockResolvedValueOnce({ ready: false, timedOut: true, durationMs: 5000 })
        .mockResolvedValueOnce({ ready: true, durationMs: 100, timedOut: false });

      vi.stubEnv('START_RETRY_ATTEMPTS', '2');

      const startPromise = retryEngine.start('srv-12', {
        id: 'srv-12',
        jarPath: '/path/to/server.jar',
        workDir: '/tmp',
      } as any);

      await vi.runAllTimersAsync();
      await startPromise;

      const startingEvents = retryMockEventBus.emit.mock.calls.filter(
        (call: any[]) => call[1]?.phase === ServerLifecyclePhase.STARTING,
      );

      expect(startingEvents.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle concurrent starts to different servers', async () => {
      const config1 = {
        id: 'srv-13',
        jarPath: '/path/to/server.jar',
        workDir: '/tmp',
      } as any;

      const config2 = {
        id: 'srv-14',
        jarPath: '/path/to/server.jar',
        workDir: '/tmp',
      } as any;

      const promise1 = retryEngine.start('srv-13', config1);
      const promise2 = retryEngine.start('srv-14', config2);

      await vi.runAllTimersAsync();
      await Promise.all([promise1, promise2]);

      expect(retryEngine.getPhase('srv-13')).toBe(ServerLifecyclePhase.RUNNING);
      expect(retryEngine.getPhase('srv-14')).toBe(ServerLifecyclePhase.RUNNING);
    });
  });
});
