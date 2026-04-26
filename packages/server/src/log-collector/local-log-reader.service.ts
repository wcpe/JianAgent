import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { watch, type FSWatcher } from 'node:fs';
import { open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
} from '../storage/drizzle.provider.js';
import {
  serverConfigs,
  logCollectionConfigs,
} from '../storage/schema.js';
import { LogParserService } from './log-parser.service.js';
import { LogIngestService } from './log-ingest.service.js';

interface WatchedLog {
  configId: string;
  serverId: string;
  serverName: string;
  filePath: string;
  format: string;
  watcher: FSWatcher;
  lastOffset: number;
}

@Injectable()
export class LocalLogReaderService implements OnModuleInit {
  private readonly logger = new Logger(LocalLogReaderService.name);
  private watched = new Map<string, WatchedLog>();

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
    private readonly parser: LogParserService,
    private readonly ingestService: LogIngestService,
  ) {}

  async onModuleInit() {
    // Query all managed servers with their log collection configs
    const configs = this.db
      .select({
        config: logCollectionConfigs,
        serverName: serverConfigs.name,
      })
      .from(logCollectionConfigs)
      .leftJoin(serverConfigs, eq(logCollectionConfigs.hostId, serverConfigs.id))
      .where(
        and(
          eq(logCollectionConfigs.hostType, 'local'),
          eq(logCollectionConfigs.enabled, true),
        ),
      )
      .all();

    for (const { config, serverName } of configs) {
      await this.watchServerLog(config.id, {
        hostId: config.hostId,
        hostName: serverName ?? config.hostId,
        sourceFile: config.filePath,
        format: config.logFormat,
        lastOffset: config.lastOffset,
      });
    }

    this.logger.log(
      `Watching ${this.watched.size} local log files for incremental collection`,
    );
  }

  /**
   * Start watching a single log file.
   * Uses fs.watch for change detection, then reads incrementally from lastOffset.
   */
  async watchServerLog(
    configId: string,
    opts: {
      hostId: string;
      hostName: string;
      sourceFile: string;
      format: string;
      lastOffset: number;
    },
  ) {
    // Stop existing watcher if present
    this.stopWatching(configId);

    // Resolve absolute path
    let absPath: string;
    try {
      absPath = resolve(opts.sourceFile);
    } catch (err) {
      this.logger.warn(`Cannot resolve path: ${opts.sourceFile}`, err);
      return;
    }

    // Check file exists
    try {
      const { stat } = await import('node:fs/promises');
      await stat(absPath);
    } catch (err) {
      this.logger.warn(`Log file not found, will retry: ${absPath}`, err);
      // Schedule a retry after 10s
      setTimeout(() => this.watchServerLog(configId, opts), 10_000);
      return;
    }

    const watcher = watch(absPath, { persistent: false }, async (eventType) => {
      if (eventType !== 'change') return;
      await this.readIncremental(configId);
    });

    this.watched.set(configId, {
      configId,
      serverId: opts.hostId,
      serverName: opts.hostName,
      filePath: absPath,
      format: opts.format,
      watcher,
      lastOffset: opts.lastOffset,
    });

    // Do an initial read
    await this.readIncremental(configId);
  }

  /**
   * Incrementally read new lines from the watched file using file handle.
   */
  private async readIncremental(configId: string): Promise<void> {
    const watched = this.watched.get(configId);
    if (!watched) return;

    let fh: Awaited<ReturnType<typeof open>> | undefined;
    try {
      const { stat } = await import('node:fs/promises');
      const fileStat = await stat(watched.filePath);
      const currentSize = fileStat.size;

      if (currentSize <= watched.lastOffset) {
        // File truncated or no new content
        if (currentSize < watched.lastOffset) {
          this.logger.log(
            `Log file truncated: ${watched.filePath}, resetting offset`,
          );
          watched.lastOffset = 0;
        }
        return;
      }

      const sizeToRead = currentSize - watched.lastOffset;
      const buffer = Buffer.alloc(sizeToRead);

      fh = await open(watched.filePath, 'r');
      const { bytesRead } = await fh.read(buffer, 0, sizeToRead, watched.lastOffset);
      await fh.close();
      fh = undefined;

      if (bytesRead === 0) return;

      const chunk = buffer.subarray(0, bytesRead).toString('utf-8');
      const lines = chunk.split('\n').filter((l) => l.length > 0);
      if (lines.length === 0) return;

      const parsed = lines.map((line) =>
        this.parser.parseLine(line, watched.format),
      );

      const count = await this.ingestService.writeEntries(parsed, {
        hostId: watched.serverId,
        hostName: watched.serverName,
        hostType: 'local',
        sourceFile: watched.filePath,
        lineNumber: watched.lastOffset,
      });

      // Update offset
      watched.lastOffset = currentSize;
      await this.ingestService.updateOffset(
        configId,
        currentSize,
        lines.length > 0
          ? createHash('sha256').update(lines[lines.length - 1]).digest('hex')
          : undefined,
      );

      this.logger.debug(
        `Read ${count} lines from ${watched.filePath} (offset ${watched.lastOffset})`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to read ${watched.filePath}: ${err}`,
      );
      if (fh) {
        try { await fh.close(); } catch (_err) { /* ignore */ }
      }
    }
  }

  /** Stop watching a config */
  stopWatching(configId: string): void {
    const watched = this.watched.get(configId);
    if (watched) {
      watched.watcher.close();
      this.watched.delete(configId);
    }
  }

  /** Stop all watchers */
  stopAll(): void {
    for (const [id] of this.watched) {
      this.stopWatching(id);
    }
  }
}
