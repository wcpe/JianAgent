import { describe, expect, it, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import { SftpFileService } from '../sftp-file.service.js';
import type { ServerConfig } from '@jian-agent/shared-domain';

function createService(sftp: Record<string, any> = {}, options?: { timeoutMs?: number }) {
  const pool = {
    getConnection: vi.fn().mockResolvedValue({
      sftp: (callback: (err: unknown, sftpClient?: any) => void) => callback(null, sftp),
    }),
  };

  return {
    pool,
    service: new SftpFileService(pool as any, options),
  };
}

const config = {
  serverDir: '/srv/minecraft',
} as ServerConfig;

describe('SftpFileService', () => {
  it('rejects paths that escape the configured remote root', async () => {
    const { service, pool } = createService();

    await expect(service.readDir(config, '../../etc')).rejects.toMatchObject({
      status: 400,
    });
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  it('maps missing-file SFTP errors to a readable HttpException', async () => {
    const sftp = {
      readdir: vi.fn((_path: string, callback: (err: any, items?: any[]) => void) => {
        const error = Object.assign(new Error('No such file'), { code: 'ENOENT' });
        callback(error);
      }),
    };
    const { service } = createService(sftp);

    try {
      await service.readDir(config, 'plugins');
      throw new Error('expected readDir to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      const response = (error as HttpException).getResponse() as { code?: string; message?: string };
      expect(response.code).toBe('FILE_NOT_FOUND');
      expect(response.message).toContain('No such file');
    }
  });

  it('maps timed-out remote operations to FILE_REMOTE_TIMEOUT', async () => {
    const sftp = {
      readdir: vi.fn((_path: string, _callback: (err: any, items?: any[]) => void) => {
        // Simulate a hung remote SFTP operation by never calling callback.
      }),
    };
    const { service } = createService(sftp, { timeoutMs: 15 });

    try {
      await service.readDir(config, 'plugins');
      throw new Error('expected readDir to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(504);
      const response = (error as HttpException).getResponse() as { code?: string; message?: string };
      expect(response.code).toBe('FILE_REMOTE_TIMEOUT');
      expect(response.message).toContain('timed out');
    }
  });
});