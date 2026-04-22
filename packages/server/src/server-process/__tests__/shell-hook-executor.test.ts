import { describe, it, expect, beforeEach } from 'vitest';
import { ShellHookExecutor } from '../lifecycle/shell-hook-executor.service.js';

describe('ShellHookExecutor', () => {
  let executor: ShellHookExecutor;

  beforeEach(() => {
    executor = new ShellHookExecutor();
  });

  it('should execute a simple echo command', async () => {
    const result = await executor.exec('echo hello', '/tmp', 5000);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
    expect(result.timedOut).toBe(false);
  });

  it('should capture stderr', async () => {
    const result = await executor.exec('echo error >&2', '/tmp', 5000);
    expect(result.exitCode).toBe(0);
    expect(result.stderr.trim()).toBe('error');
  });

  it('should handle non-zero exit code', async () => {
    const result = await executor.exec('exit 42', '/tmp', 5000);
    expect(result.exitCode).toBe(42);
  });

  it('should handle empty command gracefully', async () => {
    const result = await executor.exec('', '/tmp', 5000);
    expect(result.exitCode).toBe(0);
  });
});
