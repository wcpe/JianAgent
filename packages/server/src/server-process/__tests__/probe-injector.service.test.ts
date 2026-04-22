import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProbeInjectorService } from '../probe-injector.service.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

vi.mock('node:fs/promises');

describe('ProbeInjectorService', () => {
  let service: ProbeInjectorService;

  beforeEach(() => {
    service = new ProbeInjectorService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should skip injection when jar not found', async () => {
    vi.mocked(fs.stat).mockRejectedValueOnce(new Error('ENOENT'));
    await service.inject('/tmp/test-server', 'srv-1');
    // Should not attempt copy
    expect(fs.copyFile).not.toHaveBeenCalled();
  });

  it('should copy jar and write config when jar exists', async () => {
    vi.mocked(fs.stat).mockResolvedValueOnce({} as any);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
    vi.mocked(fs.copyFile).mockResolvedValueOnce();
    vi.mocked(fs.writeFile).mockResolvedValueOnce();

    await service.inject('/tmp/test-server', 'test-server-id');

    expect(fs.mkdir).toHaveBeenCalledWith(
      path.join('/tmp/test-server', 'plugins'),
      { recursive: true },
    );
    expect(fs.copyFile).toHaveBeenCalledOnce();
    expect(fs.writeFile).toHaveBeenCalledOnce();

    const configContent = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    expect(configContent).toContain('server-id: test-server-id');
    expect(configContent).toContain('port: ');
  });

  it('should continue without error when copy fails', async () => {
    vi.mocked(fs.stat).mockResolvedValueOnce({} as any);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
    vi.mocked(fs.copyFile).mockRejectedValueOnce(new Error('Permission denied'));

    // Should not throw
    await service.inject('/tmp/test-server', 'srv-1');
    // Should not attempt to write config after failed copy
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
});
