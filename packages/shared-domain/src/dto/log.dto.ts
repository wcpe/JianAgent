import type { LogBackendMode } from './platform-runtime-capability.dto.js';

export interface LogEntryDto {
  readonly id: number;
  readonly hostId: string;
  readonly hostName: string;
  readonly hostType: string;
  readonly sourceFile: string;
  readonly timestamp: string;
  readonly level: string;
  readonly content: string;
  readonly rawLine: string;
}

export interface LogSearchRequest {
  readonly q?: string;
  readonly hosts?: readonly string[];
  readonly level?: string;
  readonly startTime?: string;
  readonly endTime?: string;
  readonly source?: string;
  readonly page?: number;
  readonly limit?: number;
  readonly highlight?: boolean;
}

export interface LogSearchResult {
  readonly entries: readonly LogEntryDto[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly highlightMap: ReadonlyMap<number, string>;
}

export interface LogAnalyticsResult {
  readonly levelDistribution: Readonly<Record<string, number>>;
  readonly timelineBuckets: readonly { time: string; count: number }[];
  readonly topKeywords: readonly { word: string; count: number }[];
}

export interface LogAggregateSearchEntryDto {
  readonly serverId: string;
  readonly file: string;
  readonly line: number;
  readonly content: string;
}

export interface LogAggregateSearchResponseDto {
  readonly entries: readonly LogAggregateSearchEntryDto[];
  readonly backend: LogBackendMode;
  readonly degraded: boolean;
  readonly requestedBackend?: LogBackendMode;
  readonly degradationReason?: string | null;
}

export interface LogIngestEntry {
  readonly timestamp: number;
  readonly log: string;
  readonly tag?: string;
  readonly path?: string;
}

export interface LogCollectionConfigDto {
  readonly id: string;
  readonly hostId: string;
  readonly hostType: string;
  readonly filePath: string;
  readonly logFormat: string;
  readonly pollIntervalSec: number;
  readonly enabled: boolean;
  readonly lastCollectedAt: string | null;
  readonly createdAt: string;
}

export interface CreateLogCollectionConfigRequest {
  readonly hostId: string;
  readonly hostType: 'local' | 'remote';
  readonly filePath: string;
  readonly logFormat?: 'mc' | 'syslog' | 'json' | 'plain';
  readonly pollIntervalSec?: number;
}

export interface LogAlertRuleDto {
  readonly id: string;
  readonly name: string;
  readonly hostId: string | null;
  readonly pattern: string;
  readonly level: string;
  readonly cooldownSec: number;
  readonly enabled: boolean;
  readonly notificationChannelId: string | null;
  readonly lastTriggeredAt: string | null;
  readonly createdAt: string;
}

export interface CreateLogAlertRuleRequest {
  readonly name: string;
  readonly hostId?: string;
  readonly pattern: string;
  readonly level?: string;
  readonly cooldownSec?: number;
  readonly notificationChannelId?: string;
}
