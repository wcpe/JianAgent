import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { readdir, readFile, stat, open } from 'node:fs/promises';
import { createReadStream, watch, type FSWatcher } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import * as iconv from 'iconv-lite';
import { ServerConfigService } from '../server-process/server-config.service.js';
import type { ServerConfig } from '@jian-agent/shared-domain';

export interface LogFileEntry {
  readonly name: string;
  readonly size: number;
  readonly modifiedAt: string;
  readonly isGzipped: boolean;
}

export interface LogSearchResult {
  readonly file: string;
  readonly line: number;
  readonly content: string;
}

export interface LogAggregateSearchResult extends LogSearchResult {
  readonly serverId: string;
}

export interface RecentLogQueryInput {
  readonly serverIds?: readonly string[];
  readonly linesPerServer?: number;
  readonly maxTotal?: number;
}

export interface LogSearchOptions {
  readonly caseSensitive?: boolean;
  readonly fields?: readonly ('content' | 'file')[];
}

export interface TailHandle {
  readonly close: () => void;
  readonly onLine: (cb: (line: string) => void) => void;
}

@Injectable()
export class LogFileService {
  private readonly logger = new Logger(LogFileService.name);

  constructor(private readonly configService: ServerConfigService) {}

  /** List log files in the server's logs directory, sorted by modification time DESC */
  async listLogFiles(serverId: string): Promise<readonly LogFileEntry[]> {
    const logsDir = await this.resolveLogsDir(serverId);
    let names: string[];
    try {
      names = await readdir(logsDir);
    } catch {
      return [];
    }

    const entries: LogFileEntry[] = [];
    for (const name of names) {
      if (!name.endsWith('.log') && !name.endsWith('.log.gz') && !name.endsWith('.txt')) continue;
      try {
        const fullPath = join(logsDir, name);
        const s = await stat(fullPath);
        if (s.isDirectory()) continue;
        entries.push({
          name,
          size: s.size,
          modifiedAt: s.mtime.toISOString(),
          isGzipped: name.endsWith('.gz'),
        });
      } catch { /* skip inaccessible */ }
    }

    return entries.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  }

  /** Read a full log file (decompresses .gz automatically). Max 10MB uncompressed. */
  async readLogFile(serverId: string, filename: string): Promise<string> {
    this.validateFilename(filename);
    const filePath = await this.resolveLogFile(serverId, filename);

    if (filename.endsWith('.gz')) {
      return this.readGzFile(filePath);
    }

    const s = await stat(filePath);
    if (s.size > 10 * 1024 * 1024) {
      throw new BadRequestException('文件过大，请使用 tail 端点读取末尾部分');
    }
    const buf = await readFile(filePath);
    return this.decodeBuffer(buf);
  }

  /** Read the last N lines of a log file efficiently (reverse scan from EOF) */
  async tailLogFile(serverId: string, filename: string, lines = 200): Promise<string> {
    this.validateFilename(filename);
    const filePath = await this.resolveLogFile(serverId, filename);
    const s = await stat(filePath);

    if (s.size === 0) return '';

    // For gzipped files, decompress and take last N lines
    if (filename.endsWith('.gz')) {
      const content = await this.readGzFile(filePath);
      const allLines = content.split('\n');
      return allLines.slice(-lines).join('\n');
    }

    // Efficient reverse read for plain text files
    const chunkSize = Math.min(s.size, lines * 200); // estimate ~200 bytes/line
    const startPos = Math.max(0, s.size - chunkSize);
    const fh = await open(filePath, 'r');
    try {
      const buf = Buffer.alloc(s.size - startPos);
      await fh.read(buf, 0, buf.length, startPos);
      const text = this.decodeBuffer(buf);
      const allLines = text.split('\n');

      // If we didn't start from the beginning, drop the first (partial) line
      if (startPos > 0) allLines.shift();

      return allLines.slice(-lines).join('\n');
    } finally {
      await fh.close();
    }
  }

  /** Search across specified log files with a keyword */
  async searchLogFiles(
    serverId: string,
    query: string,
    filenames: readonly string[],
    maxResults = 200,
    options: LogSearchOptions = {},
  ): Promise<readonly LogSearchResult[]> {
    if (!query) return [];
    const logsDir = await this.resolveLogsDir(serverId);
    const results: LogSearchResult[] = [];
    const fields = options.fields && options.fields.length > 0 ? options.fields : ['content'];

    for (const filename of filenames) {
      if (results.length >= maxResults) break;
      this.validateFilename(filename);
      const filePath = join(logsDir, filename);
      this.ensureWithinDir(logsDir, filePath);

      try {
        const content = filename.endsWith('.gz')
          ? await this.readGzFile(filePath)
          : this.decodeBuffer(await readFile(filePath));

        const lines = content.split('\n');
        for (let i = 0; i < lines.length && results.length < maxResults; i++) {
          const line = lines[i];
          const hitContent = fields.includes('content')
            ? this.matchQuery(line, query, options.caseSensitive)
            : false;
          const hitFile = fields.includes('file')
            ? this.matchQuery(filename, query, options.caseSensitive)
            : false;

          if (hitContent || hitFile) {
            results.push({ file: filename, line: i + 1, content: lines[i] });
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return results;
  }

  /** Search logs across multiple servers and merge results with server id context. */
  async aggregateSearch(input: {
    query: string;
    serverIds?: readonly string[];
    maxPerServer?: number;
    maxTotal?: number;
    startTime?: string;
    endTime?: string;
    caseSensitive?: boolean;
    fields?: readonly ('content' | 'file')[];
  }): Promise<readonly LogAggregateSearchResult[]> {
    if (!input.query || input.query.trim() === '') return [];

    const maxPerServer = Math.min(500, Math.max(1, input.maxPerServer ?? 200));
    const maxTotal = Math.min(2000, Math.max(1, input.maxTotal ?? 500));

    const requestedIds = (input.serverIds ?? []).map((id) => id.trim()).filter(Boolean);
    const serverIds = requestedIds.length > 0
      ? requestedIds
      : (await this.configService.getAll()).map((item) => item.id);

    const merged: LogAggregateSearchResult[] = [];

    const concurrency = 4;
    for (let index = 0; index < serverIds.length && merged.length < maxTotal; index += concurrency) {
      const batch = serverIds.slice(index, index + concurrency);
      const batchResults = await Promise.all(
        batch.map((serverId) => this.searchSingleServer(serverId, input, maxPerServer)),
      );

      for (const { serverId, rows } of batchResults) {
        for (const item of rows) {
          merged.push({ ...item, serverId });
          if (merged.length >= maxTotal) break;
        }
        if (merged.length >= maxTotal) break;
      }
    }

    return merged;
  }

  async getRecentEntries(input: RecentLogQueryInput = {}): Promise<readonly LogAggregateSearchResult[]> {
    const linesPerServer = Math.min(500, Math.max(1, input.linesPerServer ?? 100));
    const maxTotal = Math.min(2000, Math.max(1, input.maxTotal ?? 500));
    const requestedIds = (input.serverIds ?? []).map((id) => id.trim()).filter(Boolean);
    const serverIds = requestedIds.length > 0
      ? requestedIds
      : (await this.configService.getAll()).map((item) => item.id);

    const merged: LogAggregateSearchResult[] = [];

    for (const serverId of serverIds) {
      if (merged.length >= maxTotal) break;

      let files: readonly LogFileEntry[] = [];
      try {
        files = await this.listLogFiles(serverId);
      } catch {
        continue;
      }
      const latest = files[0];
      if (!latest) continue;

      try {
        const content = await this.tailLogFile(serverId, latest.name, linesPerServer);
        const lines = content
          .split('\n')
          .map((line) => line.trimEnd())
          .filter(Boolean)
          .slice(-linesPerServer)
          .reverse();

        lines.forEach((line, index) => {
          if (merged.length >= maxTotal) return;
          merged.push({
            serverId,
            file: latest.name,
            line: index + 1,
            content: line,
          });
        });
      } catch {
        continue;
      }
    }

    return merged;
  }

  private async searchSingleServer(
    serverId: string,
    input: {
      query: string;
      startTime?: string;
      endTime?: string;
      caseSensitive?: boolean;
      fields?: readonly ('content' | 'file')[];
    },
    maxPerServer: number,
  ): Promise<{ serverId: string; rows: readonly LogSearchResult[] }> {
    let files: readonly LogFileEntry[] = [];
    try {
      files = await this.listLogFiles(serverId);
    } catch {
      return { serverId, rows: [] };
    }

    if (files.length === 0) return { serverId, rows: [] };

    files = this.filterFilesByModifiedTime(files, input.startTime, input.endTime);
    if (files.length === 0) return { serverId, rows: [] };

    const rows = await this.searchLogFiles(
      serverId,
      input.query,
      files.map((item) => item.name),
      maxPerServer,
      {
        caseSensitive: input.caseSensitive,
        fields: input.fields,
      },
    );

    return { serverId, rows };
  }

  private matchQuery(target: string, query: string, caseSensitive = false): boolean {
    if (caseSensitive) return target.includes(query);
    return target.toLowerCase().includes(query.toLowerCase());
  }

  private filterFilesByModifiedTime(
    files: readonly LogFileEntry[],
    startTime?: string,
    endTime?: string,
  ): readonly LogFileEntry[] {
    const startMs = startTime ? Date.parse(startTime) : NaN;
    const endMs = endTime ? Date.parse(endTime) : NaN;

    return files.filter((item) => {
      const modifiedMs = Date.parse(item.modifiedAt);
      if (!Number.isFinite(modifiedMs)) return true;
      if (Number.isFinite(startMs) && modifiedMs < startMs) return false;
      if (Number.isFinite(endMs) && modifiedMs > endMs) return false;
      return true;
    });
  }

  /** Start tailing a log file — returns a handle with close() and onLine() */
  startTail(logsDir: string, filename: string): TailHandle {
    const filePath = join(logsDir, filename);
    this.ensureWithinDir(logsDir, filePath);

    let offset = 0;
    let lineCallbacks: Array<(line: string) => void> = [];
    let watcher: FSWatcher | null = null;
    let closed = false;

    // Initialize offset to current file size
    const init = async () => {
      try {
        const s = await stat(filePath);
        offset = s.size;
      } catch {
        offset = 0;
      }

      watcher = watch(filePath, async () => {
        if (closed) return;
        try {
          const s = await stat(filePath);
          if (s.size <= offset) {
            // File was rotated/truncated
            offset = 0;
          }
          if (s.size > offset) {
            const fh = await open(filePath, 'r');
            try {
              const buf = Buffer.alloc(s.size - offset);
              await fh.read(buf, 0, buf.length, offset);
              offset = s.size;
              const text = this.decodeBuffer(buf);
              const lines = text.split('\n');
              for (const line of lines) {
                if (line.length > 0) {
                  for (const cb of lineCallbacks) cb(line);
                }
              }
            } finally {
              await fh.close();
            }
          }
        } catch {
          // File may be temporarily locked
        }
      });
    };

    init();

    return {
      close: () => {
        closed = true;
        watcher?.close();
        lineCallbacks = [];
      },
      onLine: (cb) => {
        lineCallbacks.push(cb);
      },
    };
  }

  /** Resolve the logs directory for a server */
  async resolveLogsDir(serverId: string): Promise<string> {
    const config = await this.requireConfig(serverId);
    const rootDir = config.workDir || config.serverDir;
    if (!rootDir) {
      throw new BadRequestException('服务器未配置工作目录');
    }
    const logsPath = config.logsPath || 'logs';
    return resolve(rootDir, logsPath);
  }

  // ── Private helpers ──

  private async resolveLogFile(serverId: string, filename: string): Promise<string> {
    const logsDir = await this.resolveLogsDir(serverId);
    const filePath = join(logsDir, filename);
    this.ensureWithinDir(logsDir, filePath);

    try {
      await stat(filePath);
    } catch {
      throw new NotFoundException(`日志文件不存在: ${filename}`);
    }

    return filePath;
  }

  private async readGzFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      const maxSize = 10 * 1024 * 1024; // 10MB uncompressed limit

      const gunzip = createGunzip();
      const stream = createReadStream(filePath).pipe(gunzip);

      stream.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > maxSize) {
          stream.destroy();
          reject(new BadRequestException('解压后文件过大(>10MB)'));
          return;
        }
        chunks.push(chunk);
      });
      stream.on('end', () => resolve(this.decodeBuffer(Buffer.concat(chunks))));
      stream.on('error', (err) => reject(err));
    });
  }

  private validateFilename(filename: string): void {
    if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      throw new BadRequestException(`非法文件名: ${filename}`);
    }
    if (!filename.endsWith('.log') && !filename.endsWith('.log.gz') && !filename.endsWith('.txt')) {
      throw new BadRequestException('仅支持 .log / .log.gz / .txt 文件');
    }
  }

  private ensureWithinDir(dir: string, target: string): void {
    const rel = relative(dir, resolve(target));
    if (rel.startsWith('..') || rel.includes('..')) {
      throw new BadRequestException('路径越界');
    }
  }

  /**
   * Decode a Buffer to string, auto-detecting encoding.
   * Tries UTF-8 first; if the result contains U+FFFD (replacement char)
   * or common garbled patterns, falls back to GBK.
   */
  private decodeBuffer(buf: Buffer): string {
    const utf8 = buf.toString('utf-8');
    // If the content contains replacement characters, it's likely not UTF-8
    if (utf8.includes('\uFFFD')) {
      try {
        return iconv.decode(buf, 'gbk');
      } catch {
        return utf8;
      }
    }
    return utf8;
  }

  private async requireConfig(serverId: string): Promise<ServerConfig> {
    const config = await this.configService.getById(serverId);
    if (!config) throw new NotFoundException(`服务器不存在: ${serverId}`);
    return config;
  }
}
