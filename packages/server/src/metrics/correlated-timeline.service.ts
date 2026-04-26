import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import type { DrizzleDb } from '../storage/drizzle.provider.js';
import { metricSnapshots, alerts } from '../storage/schema.js';
import { and, gte, lte, desc } from 'drizzle-orm';
import { LogSearchService } from '../log-file/log-search.service.js';
import { SystemMetricsService } from './system-metrics.service.js';

@Injectable()
export class CorrelatedTimelineService {
  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
    private readonly logSearch: LogSearchService,
    private readonly systemMetrics: SystemMetricsService,
  ) {}

  async getCorrelatedTimeline(
    serverId: string,
    startTime: string,
    endTime: string,
  ) {
    // 1. Query metric snapshots in the time range
    const metrics = await this.db
      .select()
      .from(metricSnapshots)
      .where(
        and(
          gte(metricSnapshots.timestamp, startTime),
          lte(metricSnapshots.timestamp, endTime),
        ),
      )
      .orderBy(desc(metricSnapshots.timestamp))
      .limit(120);

    // 2. Query system metrics
    const sysMetrics = this.systemMetrics.getHistory(startTime, endTime, 120);

    // 3. Query alerts in the time range
    const alertList = await this.db
      .select()
      .from(alerts)
      .where(
        and(
          gte(alerts.timestamp, startTime),
          lte(alerts.timestamp, endTime),
        ),
      )
      .orderBy(desc(alerts.timestamp))
      .limit(200);

    // 4. Query ERROR/FATAL logs via LogSearchService
    const errorLogs = this.logSearch.getErrorsInRange(startTime, endTime, undefined, 200);

    return {
      timeRange: { startTime, endTime },
      serverId,
      metrics: metrics.reverse(),
      systemMetrics: sysMetrics,
      errorLogs,
      alerts: alertList.reverse(),
    };
  }
}
