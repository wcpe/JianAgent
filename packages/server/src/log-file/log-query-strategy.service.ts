import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type {
  LogAggregateSearchEntryDto,
  LogAggregateSearchResponseDto,
  LogBackendMode,
} from '@jian-agent/shared-domain';
import { LogFileService } from './log-file.service.js';

export interface AggregateLogSearchInput {
  readonly query: string;
  readonly serverIds?: readonly string[];
  readonly maxPerServer?: number;
  readonly maxTotal?: number;
  readonly startTime?: string;
  readonly endTime?: string;
  readonly caseSensitive?: boolean;
  readonly fields?: readonly ('content' | 'file')[];
}

export interface LogQueryBackend {
  search(input: AggregateLogSearchInput): Promise<readonly LogAggregateSearchEntryDto[]>;
  recent(input: {
    serverIds?: readonly string[];
    linesPerServer?: number;
    maxTotal?: number;
    fields?: readonly ('content' | 'file')[];
  }): Promise<readonly LogAggregateSearchEntryDto[]>;
}

export interface LogQueryStrategyOptions {
  readonly logBackendMode?: LogBackendMode;
}

export const LOG_QUERY_STRATEGY_OPTIONS = Symbol('LOG_QUERY_STRATEGY_OPTIONS');

@Injectable()
export class LocalFileLogQueryBackend implements LogQueryBackend {
  constructor(private readonly logFileService: LogFileService) {}

  async search(input: AggregateLogSearchInput): Promise<readonly LogAggregateSearchEntryDto[]> {
    return this.logFileService.aggregateSearch(input);
  }

  async recent(input: {
    serverIds?: readonly string[];
    linesPerServer?: number;
    maxTotal?: number;
    fields?: readonly ('content' | 'file')[];
  }): Promise<readonly LogAggregateSearchEntryDto[]> {
    return this.logFileService.getRecentEntries(input);
  }
}

@Injectable()
export class LokiLogQueryBackend implements LogQueryBackend {
  private readonly logger = new Logger(LokiLogQueryBackend.name);

  async search(_input: AggregateLogSearchInput): Promise<readonly LogAggregateSearchEntryDto[]> {
    const baseUrl = process.env['LOKI_BASE_URL']?.trim();
    if (!baseUrl) {
      throw new Error('LOKI_UNAVAILABLE');
    }

    this.logger.warn('Loki backend requested but query integration is not configured; falling back');
    throw new Error('LOKI_UNAVAILABLE');
  }

  async recent(_input: {
    serverIds?: readonly string[];
    linesPerServer?: number;
    maxTotal?: number;
    fields?: readonly ('content' | 'file')[];
  }): Promise<readonly LogAggregateSearchEntryDto[]> {
    throw new Error('LOKI_UNAVAILABLE');
  }
}

@Injectable()
export class LogQueryStrategyService {
  constructor(
    private readonly localBackend: LocalFileLogQueryBackend,
    private readonly lokiBackend: LokiLogQueryBackend,
    @Optional()
    @Inject(LOG_QUERY_STRATEGY_OPTIONS)
    private readonly options?: LogQueryStrategyOptions,
  ) {}

  async aggregateSearch(input: AggregateLogSearchInput): Promise<LogAggregateSearchResponseDto> {
    const requestedBackend = this.resolveMode();
    if (requestedBackend === 'local-file') {
      return {
        entries: (await this.localBackend.search(input)) ?? [],
        backend: 'local-file',
        degraded: false,
        requestedBackend,
      };
    }

    try {
      const entries = await this.lokiBackend.search(input);
      return {
        entries: entries ?? [],
        backend: requestedBackend,
        degraded: false,
        requestedBackend,
      };
    } catch (error) {
      const degradationReason = this.normalizeFallbackReason(error);
      return {
        entries: (await this.localBackend.search(input)) ?? [],
        backend: 'local-file',
        degraded: true,
        requestedBackend,
        degradationReason,
      };
    }
  }

  async recentLogs(input: {
    serverIds?: readonly string[];
    linesPerServer?: number;
    maxTotal?: number;
    fields?: readonly ('content' | 'file')[];
  }): Promise<LogAggregateSearchResponseDto> {
    const requestedBackend = this.resolveMode();
    if (requestedBackend === 'local-file') {
      return {
        entries: (await this.localBackend.recent(input)) ?? [],
        backend: 'local-file',
        degraded: false,
        requestedBackend,
      };
    }

    try {
      const entries = await this.lokiBackend.recent(input);
      return {
        entries: entries ?? [],
        backend: requestedBackend,
        degraded: false,
        requestedBackend,
      };
    } catch (error) {
      return {
        entries: (await this.localBackend.recent(input)) ?? [],
        backend: 'local-file',
        degraded: true,
        requestedBackend,
        degradationReason: this.normalizeFallbackReason(error),
      };
    }
  }

  private resolveMode(): LogBackendMode {
    const configured = this.options?.logBackendMode ?? process.env['LOG_BACKEND_MODE'];
    if (configured === 'loki' || configured === 'hybrid' || configured === 'local-file') {
      return configured;
    }
    return 'local-file';
  }

  private normalizeFallbackReason(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }
    return 'LOKI_UNAVAILABLE';
  }
}
