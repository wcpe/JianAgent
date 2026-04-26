import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, gte, lte } from 'drizzle-orm';
import type { DrizzleDb } from '../storage/drizzle.provider.js';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import { legacyLogEntries as logEntries, alerts, validationRun } from '../storage/schema.js';
import type {
  SessionReportDto,
  BotStatsDto,
  ServerPerfDto,
  PhaseReportEntryDto,
  AlertSummaryReportDto,
} from '@jian-agent/shared-domain';

interface MetricRow {
  readonly timestamp: string;
  readonly message: string;
  readonly metadata: string | null;
}

@Injectable()
export class SessionReportService {
  private readonly logger = new Logger(SessionReportService.name);

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  async generateReport(sessionId: string): Promise<SessionReportDto> {
    // Query log entries tagged with this session for metric data
    const metricRows = this.db
      .select()
      .from(logEntries)
      .where(
        and(
          eq(logEntries.source, 'metrics'),
          eq(logEntries.module, sessionId),
        ),
      )
      .all();

    const startTime = metricRows.length > 0
      ? new Date(metricRows[0]!.timestamp).getTime()
      : Date.now();
    const endTime = metricRows.length > 0
      ? new Date(metricRows[metricRows.length - 1]!.timestamp).getTime()
      : Date.now();

    const parsedMetrics = metricRows.map((r) => this.parseMetadata(r));
    const botStats = this.computeBotStats(parsedMetrics);
    const serverPerf = this.computeServerPerf(parsedMetrics);
    const phases = this.buildPhaseEntries(parsedMetrics, sessionId);
    const alertSummary = await this.buildAlertSummary(sessionId);
    const conclusions = this.generateConclusions(botStats, serverPerf, phases, alertSummary);

    return {
      sessionId,
      serverId: (parsedMetrics[0]?.['serverId'] as string | undefined) ?? 'unknown',
      startTime,
      endTime,
      durationMs: endTime - startTime,
      botStats,
      serverPerf,
      phases,
      alerts: alertSummary,
      conclusions,
    };
  }

  /**
   * Generate a session report specifically for a validation run.
   * Links the report to the validation run via validationRunId.
   */
  async generateReportForValidationRun(validationRunId: string): Promise<SessionReportDto> {
    // Fetch the validation run to get the associated session
    const [run] = this.db
      .select()
      .from(validationRun)
      .where(eq(validationRun.id, validationRunId))
      .all();

    if (!run) {
      throw new NotFoundException(`Validation run ${validationRunId} not found`);
    }

    const sessionId = run.sessionId ?? validationRunId;

    // Generate the base report for the session
    const report = await this.generateReport(sessionId);

    // Return with the validationRunId linked
    return {
      ...report,
      validationRunId,
    };
  }

  async getMetricTimeSeries(
    sessionId: string,
    metric: string,
  ): Promise<readonly { timestamp: number; value: number }[]> {
    const rows = this.db
      .select()
      .from(logEntries)
      .where(
        and(
          eq(logEntries.source, 'metrics'),
          eq(logEntries.module, sessionId),
        ),
      )
      .all();

    return rows
      .map((r) => {
        const meta = this.parseMetadata(r);
        const value = meta[metric] as number | undefined;
        return value !== undefined
          ? { timestamp: new Date(r.timestamp).getTime(), value }
          : null;
      })
      .filter((p): p is { timestamp: number; value: number } => p !== null);
  }

  private parseMetadata(row: MetricRow): Record<string, unknown> {
    try {
      return row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : {};
    } catch (_err) {
      return {};
    }
  }

  private computeBotStats(metrics: readonly Record<string, unknown>[]): BotStatsDto {
    let totalSpawned = 0;
    let peakOnline = 0;
    let sumOnline = 0;
    let joinFailures = 0;
    let disconnections = 0;

    for (const m of metrics) {
      const botCount = (m['botCount'] as number | undefined) ?? 0;
      if (botCount > peakOnline) peakOnline = botCount;
      sumOnline += botCount;
      totalSpawned = Math.max(totalSpawned, (m['totalSpawned'] as number | undefined) ?? botCount);
      joinFailures += (m['joinFailures'] as number | undefined) ?? 0;
      disconnections += (m['disconnections'] as number | undefined) ?? 0;
    }

    return {
      totalSpawned,
      peakOnline,
      avgOnline: metrics.length > 0 ? Math.round(sumOnline / metrics.length) : 0,
      joinFailures,
      disconnections,
    };
  }

  private computeServerPerf(metrics: readonly Record<string, unknown>[]): ServerPerfDto {
    if (metrics.length === 0) {
      return { avgTps: 0, minTps: 0, avgMspt: 0, maxMspt: 0, avgCpuPercent: 0, peakCpuPercent: 0, avgMemoryMb: 0, peakMemoryMb: 0 };
    }

    let sumTps = 0, minTps = Infinity, sumMspt = 0, maxMspt = 0;
    let sumCpu = 0, peakCpu = 0, sumMem = 0, peakMem = 0;

    for (const m of metrics) {
      const tps = (m['tps'] as number | undefined) ?? 20;
      const mspt = (m['mspt'] as number | undefined) ?? 0;
      const cpu = (m['cpuPercent'] as number | undefined) ?? 0;
      const mem = (m['memoryMb'] as number | undefined) ?? 0;

      sumTps += tps;
      if (tps < minTps) minTps = tps;
      sumMspt += mspt;
      if (mspt > maxMspt) maxMspt = mspt;
      sumCpu += cpu;
      if (cpu > peakCpu) peakCpu = cpu;
      sumMem += mem;
      if (mem > peakMem) peakMem = mem;
    }

    const n = metrics.length;
    return {
      avgTps: Number((sumTps / n).toFixed(1)),
      minTps: minTps === Infinity ? 0 : Number(minTps.toFixed(1)),
      avgMspt: Number((sumMspt / n).toFixed(1)),
      maxMspt: Number(maxMspt.toFixed(1)),
      avgCpuPercent: Number((sumCpu / n).toFixed(1)),
      peakCpuPercent: Number(peakCpu.toFixed(1)),
      avgMemoryMb: Number((sumMem / n).toFixed(0)),
      peakMemoryMb: Number(peakMem.toFixed(0)),
    };
  }

  private buildPhaseEntries(
    metrics: readonly Record<string, unknown>[],
    _sessionId: string,
  ): readonly PhaseReportEntryDto[] {
    const phaseMap = new Map<string, { points: Record<string, unknown>[]; name: string }>();

    for (const m of metrics) {
      const phaseId = (m['phaseId'] as string | undefined) ?? 'default';
      const phaseName = (m['phaseName'] as string | undefined) ?? phaseId;
      const entry = phaseMap.get(phaseId) ?? { points: [], name: phaseName };
      entry.points.push(m);
      phaseMap.set(phaseId, entry);
    }

    return [...phaseMap.entries()].map(([phaseId, { points, name }]) => {
      const tpsValues = points.map((p) => (p['tps'] as number | undefined) ?? 20);
      const msptValues = points.map((p) => (p['mspt'] as number | undefined) ?? 0);
      const avgTps = tpsValues.reduce((a, b) => a + b, 0) / tpsValues.length;
      const avgMspt = msptValues.reduce((a, b) => a + b, 0) / msptValues.length;
      const botCount = Math.max(
        ...points.map((p) => (p['botCount'] as number | undefined) ?? 0),
      );

      return {
        phaseId,
        phaseName: name,
        startTime: (points[0]?.['timestamp'] as number | undefined) ?? 0,
        endTime: (points[points.length - 1]?.['timestamp'] as number | undefined) ?? 0,
        botCount,
        avgTps: Number(avgTps.toFixed(1)),
        avgMspt: Number(avgMspt.toFixed(1)),
        status: 'completed' as const,
      };
    });
  }

  private async buildAlertSummary(sessionId: string): Promise<AlertSummaryReportDto> {
    const rows = this.db
      .select()
      .from(alerts)
      .where(eq(alerts.serverId, sessionId))
      .all();

    const bySeverity: Record<string, number> = {};
    const ruleCount: Record<string, number> = {};

    for (const row of rows) {
      bySeverity[row.level] = (bySeverity[row.level] ?? 0) + 1;
      ruleCount[row.ruleName] = (ruleCount[row.ruleName] ?? 0) + 1;
    }

    const topAlerts = Object.entries(ruleCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([rule, count]) => ({ rule, count }));

    return { total: rows.length, bySeverity, topAlerts };
  }

  private generateConclusions(
    botStats: BotStatsDto,
    serverPerf: ServerPerfDto,
    phases: readonly PhaseReportEntryDto[],
    alertSummary: AlertSummaryReportDto,
  ): readonly string[] {
    const lines: string[] = [];
    const hasMetricData = serverPerf.avgTps > 0 || serverPerf.peakCpuPercent > 0;

    if (hasMetricData && serverPerf.minTps < 15) {
      lines.push(`TPS 最低降至 ${serverPerf.minTps.toFixed(1)}，服务器在高压阶段存在性能瓶颈`);
    }
    if (serverPerf.maxMspt > 50) {
      lines.push(`MSPT 峰值 ${serverPerf.maxMspt.toFixed(1)}ms，需关注主线程阻塞`);
    }
    if (botStats.totalSpawned > 0 && botStats.joinFailures > botStats.totalSpawned * 0.1) {
      lines.push(
        `加入失败率 ${((botStats.joinFailures / botStats.totalSpawned) * 100).toFixed(1)}% 超过阈值`,
      );
    }
    const failedPhases = phases.filter((p) => p.status === 'failed');
    if (failedPhases.length > 0) {
      lines.push(`${failedPhases.length} 个阶段失败: ${failedPhases.map((p) => p.phaseName).join(', ')}`);
    }
    if (alertSummary.total > 10) {
      lines.push(`共触发 ${alertSummary.total} 条告警，需重点关注`);
    }
    if (lines.length === 0) {
      lines.push('测试会话整体表现良好，未发现明显性能问题');
    }

    return lines;
  }
}
