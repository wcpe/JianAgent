import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import { LogAggregatorService } from './log-aggregator.service.js';

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
    const result = await this.logAggregator.query({
      level: filters.level as any,
      source: filters.source as any,
      startTime: filters.startTime,
      endTime: filters.endTime,
      limit: 10000,
    });
    const entries = Array.isArray(result) ? result : (result as any).data ?? [];
    const lines: string[] = ['timestamp,level,source,module,message'];
    for (const entry of entries) {
      const escaped = String(entry.message ?? '').replace(/"/g, '""');
      lines.push(`"${entry.timestamp}","${entry.level}","${entry.source}","${entry.module ?? ''}","${escaped}"`);
    }
    return Readable.from(lines.join('\n'));
  }

  async exportJson(filters: LogExportFilters): Promise<Readable> {
    const result = await this.logAggregator.query({
      level: filters.level as any,
      source: filters.source as any,
      startTime: filters.startTime,
      endTime: filters.endTime,
      limit: 10000,
    });
    const entries = Array.isArray(result) ? result : (result as any).data ?? [];
    return Readable.from(JSON.stringify(entries, null, 2));
  }
}
