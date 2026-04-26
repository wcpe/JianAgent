import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AlertLevel, MetricSnapshotDto, JmxMetricSnapshotDto, MonitoringOverviewDto, MonitoringSignalDto, MonitoringHealthState } from '@jian-agent/shared-domain';
import { AlertEngineService } from './alert-engine.service.js';
import { AlertStoreService } from './alert-store.service.js';
import { JmxMetricsService } from './jmx-metrics.service.js';
import { JmxSchedulerService } from './jmx-scheduler.service.js';
import { MetricStoreService } from '../storage/metric-store.service.js';
import { PlatformRuntimeService } from '../platform-runtime/platform-runtime.service.js';

interface ThresholdSignalInput {
  readonly source: MonitoringSignalDto['source'];
  readonly metric: string;
  readonly level: AlertLevel;
  readonly message: string;
  readonly value: number | null;
  readonly threshold: number | null;
}

@Injectable()
export class MonitoringOverviewService {
  private readonly cache = new Map<string, { data: MonitoringOverviewDto; expiresAt: number }>();
  private static readonly CACHE_TTL_MS = 3000;

  constructor(
    private readonly metricStore: MetricStoreService,
    private readonly jmxMetrics: JmxMetricsService,
    private readonly alertEngine: AlertEngineService,
    private readonly alertStore: AlertStoreService,
    private readonly jmxScheduler: JmxSchedulerService,
    private readonly platformRuntime: PlatformRuntimeService,
  ) {}

  async getOverview(serverId: string): Promise<MonitoringOverviewDto> {
    const cached = this.cache.get(serverId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const [latestProbe, latestJmx, alertSummary, activeRules, schedules] = await Promise.all([
      this.metricStore.getLatest(serverId),
      this.jmxMetrics.getLatest(serverId),
      this.alertEngine.getSummary(),
      this.alertStore.getEnabledRules(),
      Promise.resolve(this.jmxScheduler.listSchedules()),
    ]);

    const serverSchedules = schedules.filter((item) => item.serverId === serverId);
    const signals = this.buildSignals(latestProbe ?? null, latestJmx ?? null, serverSchedules);
    const runtime = this.platformRuntime.getCapabilities();
    const logBackendState = this.resolveLogBackendState(runtime.logBackendMode);

    const result: MonitoringOverviewDto = {
      serverId,
      generatedAt: new Date().toISOString(),
      state: this.resolveState(signals),
      backend: runtime.logBackendMode,
      degradedMode: logBackendState !== 'healthy',
      logBackendState,
      probeRuntimeKind: runtime.probeRuntimeKind,
      latestProbe: latestProbe ?? null,
      latestJmx: latestJmx ?? null,
      alertSummary,
      activeRuleCount: activeRules.length,
      activeJmxScheduleCount: serverSchedules.length,
      signals,
    };

    this.cache.set(serverId, { data: result, expiresAt: Date.now() + MonitoringOverviewService.CACHE_TTL_MS });
    return result;
  }

  private buildSignals(
    latestProbe: MetricSnapshotDto | null,
    latestJmx: JmxMetricSnapshotDto | null,
    schedules: readonly { readonly heapUsedThresholdMb?: number; readonly threadThreshold?: number }[],
  ): MonitoringSignalDto[] {
    const signals: MonitoringSignalDto[] = [];

    if (latestProbe) {
      if (typeof latestProbe.tps === 'number' && latestProbe.tps < 18) {
        signals.push(this.signal({ source: 'probe', metric: 'TPS', level: latestProbe.tps < 15 ? 'CRITICAL' : 'WARNING', message: `TPS 低于健康阈值: ${latestProbe.tps.toFixed(1)}`, value: latestProbe.tps, threshold: 18 }));
      }

      if (typeof latestProbe.mspt === 'number' && latestProbe.mspt > 50) {
        signals.push(this.signal({ source: 'probe', metric: 'MSPT', level: latestProbe.mspt > 80 ? 'CRITICAL' : 'WARNING', message: `MSPT 高于健康阈值: ${latestProbe.mspt.toFixed(1)}ms`, value: latestProbe.mspt, threshold: 50 }));
      }

      if (typeof latestProbe.cpuUsage === 'number' && latestProbe.cpuUsage > 80) {
        signals.push(this.signal({ source: 'probe', metric: 'CPU_USAGE', level: latestProbe.cpuUsage > 95 ? 'CRITICAL' : 'WARNING', message: `CPU 使用率偏高: ${latestProbe.cpuUsage.toFixed(1)}%`, value: latestProbe.cpuUsage, threshold: 80 }));
      }

      if (typeof latestProbe.memoryUsageMb === 'number' && typeof latestProbe.maxMemoryMb === 'number' && latestProbe.maxMemoryMb > 0) {
        const memoryUsagePercent = (latestProbe.memoryUsageMb / latestProbe.maxMemoryMb) * 100;
        if (memoryUsagePercent > 85) {
          signals.push(this.signal({ source: 'probe', metric: 'MEMORY_USAGE', level: memoryUsagePercent > 95 ? 'CRITICAL' : 'WARNING', message: `内存使用率偏高: ${memoryUsagePercent.toFixed(1)}%`, value: memoryUsagePercent, threshold: 85 }));
        }
      }
    }

    if (latestJmx) {
      const heapThreshold = this.selectThreshold(schedules, 'heapUsedThresholdMb');
      const threadThreshold = this.selectThreshold(schedules, 'threadThreshold');

      if (typeof latestJmx.heapUsedMb === 'number') {
        if (typeof heapThreshold === 'number' && latestJmx.heapUsedMb > heapThreshold) {
          signals.push(this.signal({ source: 'jmx', metric: 'HEAP_USED_MB', level: 'CRITICAL', message: `JVM 堆内存超过阈值: ${latestJmx.heapUsedMb.toFixed(1)}MB > ${heapThreshold}MB`, value: latestJmx.heapUsedMb, threshold: heapThreshold }));
        } else if (typeof latestJmx.heapMaxMb === 'number' && latestJmx.heapMaxMb > 0) {
          const heapRatio = (latestJmx.heapUsedMb / latestJmx.heapMaxMb) * 100;
          if (heapRatio > 85) {
            signals.push(this.signal({ source: 'jmx', metric: 'HEAP_USED_RATIO', level: heapRatio > 95 ? 'CRITICAL' : 'WARNING', message: `JVM 堆使用率偏高: ${heapRatio.toFixed(1)}%`, value: heapRatio, threshold: 85 }));
          }
        }
      }

      if (typeof latestJmx.threadCount === 'number') {
        const effectiveThreadThreshold = typeof threadThreshold === 'number' ? threadThreshold : 200;
        if (latestJmx.threadCount > effectiveThreadThreshold) {
          signals.push(this.signal({ source: 'jmx', metric: 'THREAD_COUNT', level: latestJmx.threadCount > effectiveThreadThreshold + 100 ? 'CRITICAL' : 'WARNING', message: `JVM 线程数偏高: ${latestJmx.threadCount.toFixed(0)} > ${effectiveThreadThreshold}`, value: latestJmx.threadCount, threshold: effectiveThreadThreshold }));
        }
      }
    }

    return signals.sort((a, b) => this.severityScore(b.level) - this.severityScore(a.level));
  }

  private signal(input: ThresholdSignalInput): MonitoringSignalDto {
    return {
      id: randomUUID(),
      source: input.source,
      metric: input.metric,
      level: input.level,
      message: input.message,
      value: input.value,
      threshold: input.threshold,
    };
  }

  private selectThreshold<T extends 'heapUsedThresholdMb' | 'threadThreshold'>(
    schedules: readonly { readonly heapUsedThresholdMb?: number; readonly threadThreshold?: number }[],
    key: T,
  ): number | null {
    const values = schedules
      .map((item) => item[key])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (values.length === 0) return null;
    return Math.min(...values);
  }

  private resolveState(signals: readonly MonitoringSignalDto[]): MonitoringHealthState {
    if (signals.some((item) => item.level === 'CRITICAL')) return 'critical';
    if (signals.length > 0) return 'degraded';
    return 'healthy';
  }

  private severityScore(level: AlertLevel): number {
    switch (level) {
      case 'CRITICAL':
        return 3;
      case 'WARNING':
        return 2;
      case 'INFO':
        return 1;
      default:
        return 0;
    }
  }

  private resolveLogBackendState(
    mode: NonNullable<MonitoringOverviewDto['backend']>,
  ): NonNullable<MonitoringOverviewDto['logBackendState']> {
    const hasLoki = Boolean(process.env['LOKI_BASE_URL']?.trim());
    if (mode === 'local-file') {
      return 'healthy';
    }
    if (mode === 'loki') {
      return hasLoki ? 'healthy' : 'unavailable';
    }
    return hasLoki ? 'healthy' : 'degraded';
  }
}
