import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { DrizzleDb } from '../storage/drizzle.provider.js';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import { legacyLogEntries as logEntries } from '../storage/schema.js';
import { nanoid } from 'nanoid';
import type { ServerOutputEvent } from '../event-bus/events.js';

interface LogLine {
  readonly id: string;
  readonly serverId: string;
  readonly stream: 'stdout' | 'stderr';
  readonly line: string;
  readonly timestamp: string;
}

@Injectable()
export class LogPersistService implements OnModuleDestroy {
  private readonly logger = new Logger(LogPersistService.name);
  private readonly buffer: LogLine[] = [];
  private readonly flushTimer: ReturnType<typeof setInterval>;
  private readonly lineBuffers = new Map<string, string>();

  private static readonly FLUSH_INTERVAL = 3_000;
  private static readonly FLUSH_THRESHOLD = 100;

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, LogPersistService.FLUSH_INTERVAL);
  }

  onModuleDestroy(): void {
    clearInterval(this.flushTimer);
    void this.flush();
  }

  @OnEvent('server.output')
  handleServerOutput(event: ServerOutputEvent): void {
    const key = `${event.serverId}:${event.stream}`;
    const existing = this.lineBuffers.get(key) ?? '';
    const combined = existing + event.chunk;
    const parts = combined.split('\n');

    const incomplete = parts.pop() ?? '';
    this.lineBuffers.set(key, incomplete);

    const ts = new Date(event.timestamp).toISOString();
    for (const line of parts) {
      if (line.length === 0) continue;
      this.buffer.push({
        id: nanoid(),
        serverId: event.serverId,
        stream: event.stream,
        line,
        timestamp: ts,
      });
    }

    if (this.buffer.length >= LogPersistService.FLUSH_THRESHOLD) {
      void this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = this.buffer.splice(0, this.buffer.length);
    try {
      for (const entry of entries) {
        this.db.insert(logEntries).values({
          id: entry.id,
          serverId: entry.serverId,
          level: entry.stream === 'stderr' ? 'ERROR' : 'INFO',
          message: entry.line,
          timestamp: entry.timestamp,
          source: 'SERVER_PROCESS',
          module: 'mc-output',
        }).run();
      }
    } catch (err) {
      this.logger.warn(`Failed to flush log entries: ${err}`);
      this.buffer.unshift(...entries);
    }
  }
}
