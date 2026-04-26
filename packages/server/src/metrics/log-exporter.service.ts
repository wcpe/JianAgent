import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import { LogAggregatorService } from './log-aggregator.service.js';
import type { LogSearchResult } from '@jian-agent/shared-domain';

interface LogExportFilters {
  readonly level?: string;
  readonly source?: string;
  readonly startTime?: string;
  readonly endTime?: string;
}

@Injectable()
export class LogExporterService {
  constructor(private readonly logAggregator: LogAggregatorService) {}

  async exportCsv(filters: LogExportFilters): Promise<Readable> {
    const result: LogSearchResult = await this.logAggregator.query({
      level: filters.level,
      source: filters.source,
      startTime: filters.startTime,
      endTime: filters.endTime,
      limit: 10000,
    });
    const entries = result.entries;
    const lines: string[] = ['timestamp,level,source,module,message'];
    for (const entry of entries) {
      const escaped = String(entry.content ?? '').replace(/"/g, '""');
      lines.push(`"${entry.timestamp}","${entry.level}","${entry.sourceFile}","${entry.hostType ?? ''}","${escaped}"`);
    }
    return Readable.from(lines.join('\n'));
  }

  async exportJson(filters: LogExportFilters): Promise<Readable> {
    const result: LogSearchResult = await this.logAggregator.query({
      level: filters.level,
      source: filters.source,
      startTime: filters.startTime,
      endTime: filters.endTime,
      limit: 10000,
    });
    const entries = result.entries;
    return Readable.from(JSON.stringify(entries, null, 2));
  }
}
