import { Injectable, HttpException, HttpStatus, Logger, Optional, Inject } from '@nestjs/common';
import type { SFTPWrapper, Stats } from 'ssh2';
import { SshPoolService } from './ssh-pool.service.js';
import type { SshConnectConfig } from '@jian-agent/shared-domain';
import { posix } from 'node:path';

export interface FileEntry {
  readonly name: string;
  readonly path: string;
  readonly isDirectory: boolean;
  readonly size: number;
  readonly modifiedAt: string;
  readonly permissions: string;
}

export interface FileStat {
  readonly isDirectory: boolean;
  readonly size: number;
  readonly modifiedAt: string;
  readonly permissions: string;
}

type FileManagerErrorCode =
  | 'FILE_ROOT_NOT_CONFIGURED'
  | 'FILE_PATH_OUT_OF_BOUNDS'
  | 'FILE_NOT_FOUND'
  | 'FILE_PERMISSION_DENIED'
  | 'FILE_ALREADY_EXISTS'
  | 'FILE_NOT_DIRECTORY'
  | 'FILE_IS_DIRECTORY'
  | 'FILE_REMOTE_TIMEOUT'
  | 'FILE_REMOTE_UNAVAILABLE'
  | 'FILE_SFTP_ERROR';

interface FileManagerErrorBody {
  readonly code: FileManagerErrorCode;
  readonly message: string;
  readonly operation?: string;
  readonly path?: string;
  readonly root?: string;
  readonly cause?: string;
}

interface SftpFileServiceOptions {
  readonly timeoutMs?: number;
}

const DEFAULT_OPERATION_TIMEOUT_MS = 10_000;

class SftpOperationTimeoutError extends Error {
  readonly code = 'FILE_REMOTE_TIMEOUT';

  constructor(
    readonly operation: string,
    readonly path: string,
    readonly timeoutMs: number,
  ) {
    super(`Remote file operation timed out after ${timeoutMs}ms (${operation}: ${path})`);
    this.name = 'SftpOperationTimeoutError';
  }
}

@Injectable()
export class SftpFileService {
  private readonly logger = new Logger(SftpFileService.name);
  private readonly operationTimeoutMs: number;

  constructor(
    private readonly pool: SshPoolService,
    @Optional() options?: SftpFileServiceOptions,
  ) {
    this.operationTimeoutMs = options?.timeoutMs ?? DEFAULT_OPERATION_TIMEOUT_MS;
  }

  async readDir(config: SshConnectConfig, dirPath: string): Promise<readonly FileEntry[]> {
    const safePath = this.resolveSafe(config.serverDir ?? "/", dirPath);
    return this.withSftp(config, 'readDir', safePath, async (sftp) => {
      const list = await new Promise<any[]>((resolve, reject) => {
        sftp.readdir(safePath, (err, items) => (err ? reject(err) : resolve(items)));
      });
      return list
        .filter((item) => !item.filename.startsWith('.'))
        .map((item) => ({
          name: item.filename,
          path: posix.join(dirPath, item.filename),
          isDirectory: (item.attrs.mode & 0o040000) !== 0,
          size: item.attrs.size,
          modifiedAt: new Date(item.attrs.mtime * 1000).toISOString(),
          permissions: (item.attrs.mode & 0o777).toString(8),
        }))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
    });
  }

  async readFile(config: SshConnectConfig, filePath: string): Promise<Buffer> {
    const safePath = this.resolveSafe(config.serverDir ?? "/", filePath);
    return this.withSftp(config, 'readFile', safePath, async (sftp) => {
      return await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        const stream = sftp.createReadStream(safePath);
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    });
  }

  async writeFile(config: SshConnectConfig, filePath: string, content: Buffer | string): Promise<void> {
    const safePath = this.resolveSafe(config.serverDir ?? "/", filePath);
    await this.withSftp(config, 'writeFile', safePath, async (sftp) => {
      await new Promise<void>((resolve, reject) => {
        const data = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
        const stream = sftp.createWriteStream(safePath);
        stream.on('close', () => resolve());
        stream.on('error', reject);
        stream.end(data);
      });
    });
  }

  async uploadFile(config: SshConnectConfig, remotePath: string, data: Buffer): Promise<void> {
    return this.writeFile(config, remotePath, data);
  }

  async deleteFile(config: SshConnectConfig, filePath: string): Promise<void> {
    const safePath = this.resolveSafe(config.serverDir ?? "/", filePath);
    await this.withSftp(config, 'deleteFile', safePath, async (sftp) => {
      const statResult = await this.statRaw(sftp, safePath);
      if ((statResult.mode & 0o040000) !== 0) {
        await this.rmDirRecursive(sftp, safePath);
      } else {
        await new Promise<void>((resolve, reject) => {
          sftp.unlink(safePath, (err) => (err ? reject(err) : resolve()));
        });
      }
    });
  }

  async mkdir(config: SshConnectConfig, dirPath: string): Promise<void> {
    const safePath = this.resolveSafe(config.serverDir ?? "/", dirPath);
    await this.withSftp(config, 'mkdir', safePath, async (sftp) => {
      await new Promise<void>((resolve, reject) => {
        sftp.mkdir(safePath, (err) => (err ? reject(err) : resolve()));
      });
    });
  }

  async stat(config: SshConnectConfig, filePath: string): Promise<FileStat> {
    const safePath = this.resolveSafe(config.serverDir ?? "/", filePath);
    return this.withSftp(config, 'stat', safePath, async (sftp) => {
      const s = await this.statRaw(sftp, safePath);
      return {
        isDirectory: (s.mode & 0o040000) !== 0,
        size: s.size,
        modifiedAt: new Date(s.mtime * 1000).toISOString(),
        permissions: (s.mode & 0o777).toString(8),
      };
    });
  }

  async rename(config: SshConnectConfig, oldPath: string, newPath: string): Promise<void> {
    const safeOld = this.resolveSafe(config.serverDir ?? "/", oldPath);
    const safeNew = this.resolveSafe(config.serverDir ?? "/", newPath);
    await this.withSftp(config, 'rename', `${safeOld} -> ${safeNew}`, async (sftp) => {
      await new Promise<void>((resolve, reject) => {
        sftp.rename(safeOld, safeNew, (err) => (err ? reject(err) : resolve()));
      });
    });
  }

  async exists(config: SshConnectConfig, filePath: string): Promise<boolean> {
    try {
      await this.stat(config, filePath);
      return true;
    } catch (_err) {
      return false;
    }
  }

  /** Resolve path safely within serverDir root. Rejects path traversal. */
  private resolveSafe(serverDir: string, relativePath: string): string {
    const root = posix.normalize(serverDir.replace(/\\/g, '/').trim());
    if (!root || root === '.') {
      throw this.createHttpError(
        HttpStatus.BAD_REQUEST,
        'FILE_ROOT_NOT_CONFIGURED',
        'Remote root directory is not configured',
        { path: relativePath },
      );
    }

    // Strip leading slashes so '/' maps to serverDir root.
    const stripped = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const normalized = posix.normalize(stripped || '.');
    const candidate = normalized === '.' ? root : posix.join(root, normalized);
    const relative = posix.relative(root, candidate);

    if (relative.startsWith('..') || posix.isAbsolute(relative)) {
      throw this.createHttpError(
        HttpStatus.BAD_REQUEST,
        'FILE_PATH_OUT_OF_BOUNDS',
        'Path escapes the configured remote root',
        { path: relativePath, root },
      );
    }

    return candidate;
  }

  private async getSftp(config: SshConnectConfig): Promise<SFTPWrapper> {
    const client = await this.pool.getConnection(config);
    return new Promise<SFTPWrapper>((resolve, reject) => {
      client.sftp((err, sftp) => (err ? reject(err) : resolve(sftp)));
    });
  }

  private releaseSftp(config: SshConnectConfig, _sftp: SFTPWrapper): void {
    // SFTP channel shares the SSH connection — just release the connection ref
    // Note: we don't release here because the connection stays in the pool
  }

  private statRaw(sftp: SFTPWrapper, path: string): Promise<Stats> {
    return new Promise((resolve, reject) => {
      sftp.stat(path, (err, stats) => (err ? reject(err) : resolve(stats)));
    });
  }

  private async withSftp<T>(
    config: SshConnectConfig,
    operation: string,
    path: string,
    run: (sftp: SFTPWrapper) => Promise<T>,
  ): Promise<T> {
    let sftp: SFTPWrapper | undefined;
    try {
      sftp = await this.getSftp(config);
      return await this.withOperationTimeout(run(sftp), operation, path);
    } catch (error: unknown) {
      throw this.normalizeSftpError(error, operation, path);
    } finally {
      if (sftp) {
        this.releaseSftp(config, sftp);
      }
    }
  }

  private normalizeSftpError(error: unknown, operation: string, path: string): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    const err = error as { code?: unknown; message?: unknown; errno?: unknown; reason?: unknown; description?: unknown };
    const message = typeof err.message === 'string' && err.message.trim() ? err.message.trim() : 'SFTP operation failed';

    if (err.code === 'FILE_REMOTE_TIMEOUT') {
      return this.createHttpError(
        HttpStatus.GATEWAY_TIMEOUT,
        'FILE_REMOTE_TIMEOUT',
        message,
        { operation, path, cause: message },
      );
    }

    const fingerprint = [err.code, err.errno, err.reason, err.description, message]
      .filter((value) => typeof value === 'string' || typeof value === 'number')
      .map((value) => String(value).toLowerCase())
      .join(' ');

    if (this.matchesError(fingerprint, ['enoent', 'sftp_fx_no_such_file', 'no such file', 'not found'])) {
      return this.createHttpError(HttpStatus.NOT_FOUND, 'FILE_NOT_FOUND', `Remote path not found: ${path} (${message})`, {
        operation,
        path,
        cause: message,
      });
    }

    if (this.matchesError(fingerprint, ['eacces', 'eperm', 'sftp_fx_permission_denied', 'permission denied'])) {
      return this.createHttpError(HttpStatus.FORBIDDEN, 'FILE_PERMISSION_DENIED', `Permission denied for remote path: ${path} (${message})`, {
        operation,
        path,
        cause: message,
      });
    }

    if (this.matchesError(fingerprint, ['eexist', 'sftp_fx_file_already_exists', 'file already exists'])) {
      return this.createHttpError(HttpStatus.CONFLICT, 'FILE_ALREADY_EXISTS', `Remote path already exists: ${path} (${message})`, {
        operation,
        path,
        cause: message,
      });
    }

    if (this.matchesError(fingerprint, ['enotdir', 'sftp_fx_not_a_directory', 'not a directory'])) {
      return this.createHttpError(HttpStatus.BAD_REQUEST, 'FILE_NOT_DIRECTORY', `Remote path is not a directory: ${path} (${message})`, {
        operation,
        path,
        cause: message,
      });
    }

    if (this.matchesError(fingerprint, ['eisdir', 'sftp_fx_is_a_directory', 'is a directory'])) {
      return this.createHttpError(HttpStatus.BAD_REQUEST, 'FILE_IS_DIRECTORY', `Remote path is a directory: ${path} (${message})`, {
        operation,
        path,
        cause: message,
      });
    }

    if (this.matchesError(fingerprint, ['econnreset', 'etimedout', 'econnrefused', 'ehostunreach', 'network is unreachable', 'socket hang up'])) {
      return this.createHttpError(HttpStatus.SERVICE_UNAVAILABLE, 'FILE_REMOTE_UNAVAILABLE', `Remote file service is unavailable while performing ${operation} (${message})`, {
        operation,
        path,
        cause: message,
      });
    }

    return this.createHttpError(HttpStatus.BAD_GATEWAY, 'FILE_SFTP_ERROR', `SFTP ${operation} failed for ${path} (${message})`, {
      operation,
      path,
      cause: message,
    });
  }

  private matchesError(fingerprint: string, needles: readonly string[]): boolean {
    return needles.some((needle) => fingerprint.includes(needle));
  }

  private createHttpError(
    status: HttpStatus,
    code: FileManagerErrorCode,
    message: string,
    details: Omit<FileManagerErrorBody, 'code' | 'message'> = {},
  ): HttpException {
    return new HttpException({ code, message, ...details }, status);
  }

  private async withOperationTimeout<T>(runPromise: Promise<T>, operation: string, path: string): Promise<T> {
    if (this.operationTimeoutMs <= 0) {
      return runPromise;
    }

    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new SftpOperationTimeoutError(operation, path, this.operationTimeoutMs));
      }, this.operationTimeoutMs);

      runPromise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error: unknown) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async rmDirRecursive(sftp: SFTPWrapper, dirPath: string): Promise<void> {
    const list = await new Promise<any[]>((resolve, reject) => {
      sftp.readdir(dirPath, (err, items) => (err ? reject(err) : resolve(items)));
    });
    for (const item of list) {
      const fullPath = posix.join(dirPath, item.filename);
      if ((item.attrs.mode & 0o040000) !== 0) {
        await this.rmDirRecursive(sftp, fullPath);
      } else {
        await new Promise<void>((resolve, reject) => {
          sftp.unlink(fullPath, (err) => (err ? reject(err) : resolve()));
        });
      }
    }
    await new Promise<void>((resolve, reject) => {
      sftp.rmdir(dirPath, (err) => (err ? reject(err) : resolve()));
    });
  }
}
