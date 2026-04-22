import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileTaskExecutor } from '../file-task.executor.js';

describe('FileTaskExecutor', () => {
  const task = {
    taskId: 'task-1',
    serverId: 'srv-1',
    kind: 'UPLOAD',
    sourcePaths: ['/tmp/a.txt'],
    state: 'PENDING',
    progress: 0,
    attempt: 1,
    maxAttempts: 3,
    retryable: true,
    resumeToken: null,
    failureClass: null,
  } as any;

  let taskService: any;
  let fileManager: any;
  let executor: FileTaskExecutor;

  beforeEach(() => {
    vi.useFakeTimers();
    taskService = {
      createTask: vi.fn().mockResolvedValue(task),
      getTask: vi.fn().mockResolvedValue(task),
      markRunning: vi.fn().mockResolvedValue({ ...task, state: 'RUNNING' }),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      markRetryScheduled: vi.fn().mockResolvedValue({ ...task, state: 'RUNNING', attempt: 2 }),
      markCompleted: vi.fn().mockResolvedValue({ ...task, state: 'COMPLETED', attempt: 2 }),
      markFailed: vi.fn().mockResolvedValue({ ...task, state: 'FAILED' }),
      cancelTask: vi.fn(),
    };
    fileManager = {};
    executor = new FileTaskExecutor(taskService, fileManager);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries timeout-like failures and then completes', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new Error('Remote file operation timed out'))
      .mockResolvedValueOnce('artifact.zip');

    executor.registerStrategy('UPLOAD', { execute });

    await executor.submit({
      serverId: 'srv-1',
      kind: 'UPLOAD',
      sourcePaths: ['/tmp/a.txt'],
      targetPath: 'plugins',
    });

    await vi.advanceTimersByTimeAsync(600);

    expect(taskService.markRetryScheduled).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        attempt: 2,
        maxAttempts: 3,
        retryable: true,
        failureClass: 'network-timeout',
      }),
    );
    expect(taskService.markCompleted).toHaveBeenCalledWith(
      'task-1',
      'artifact.zip',
      expect.objectContaining({
        attempt: 2,
        maxAttempts: 3,
      }),
    );
  });

  it('fails immediately for non-retryable errors', async () => {
    const execute = vi.fn().mockRejectedValueOnce(new Error('permission denied'));
    executor.registerStrategy('UPLOAD', { execute });

    await executor.submit({
      serverId: 'srv-1',
      kind: 'UPLOAD',
      sourcePaths: ['/tmp/a.txt'],
    });

    await vi.runAllTimersAsync();

    expect(taskService.markRetryScheduled).not.toHaveBeenCalled();
    expect(taskService.markFailed).toHaveBeenCalledWith(
      'task-1',
      'permission denied',
      expect.stringContaining('permission denied'),
      expect.objectContaining({
        failureClass: 'authentication',
        retryable: false,
      }),
    );
  });
});
