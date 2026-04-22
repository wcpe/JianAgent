import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { LogStoreService } from './log-store.service.js';
import type { LogEntryDto, LogSearchRequest, LogSearchResult } from '@jian-agent/shared-domain';

export interface LogInput {
  readonly level: string;
  readonly source: string;
  readonly module: string;
  readonly message: string;
  readonly serverId?: string;
  readonly metadata?: Record<string, unknown>;
}

@Injectable()
export class LogAggregatorService extends EventEmitter {
  private readonly logger = new Logger(LogAggregatorService.name);

  constructor(private readonly logStore: LogStoreService) {
    super();
  }

  async ingest(input: LogInput): Promise<void> {
    const entry = {
      timestamp: new Date().toISOString(),
      level: input.level,
      source: input.source,
      module: input.module,
      message: input.message,
      serverId: input.serverId,
    };

    const id = await this.logStore.insert(entry);

    const fullEntry: LogEntryDto = {
      id: typeof id === 'number' ? id : Number(id) || 0,
      hostId: entry.serverId ?? '',
      hostName: '',
      hostType: '',
      sourceFile: '',
      timestamp: entry.timestamp,
      level: entry.level,
      content: entry.message,
      rawLine: entry.message,
    };
    this.emit('log.entry', fullEntry);
  }

  async query(filter: LogSearchRequest): Promise<LogSearchResult> {
    return this.logStore.query(filter);
  }

  getRecent(limit = 100): Promise<LogSearchResult> {
    return this.logStore.query({ limit });
  }
}
