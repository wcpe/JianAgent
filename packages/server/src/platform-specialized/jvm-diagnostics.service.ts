import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  JvmDiagnosticsSummaryDto,
  JvmHealthState,
  JvmRiskSignalDto,
  JvmRiskSignalType,
  AlertLevel,
  JvmTargetDto,
  JmxMetricSnapshotDto,
  JfrTaskDto,
  MonitoringOverviewDto,
} from '@jian-agent/shared-domain';
import { JvmCapabilityFacade } from '../java-helper/jvm-capability.facade.js';
import { JmxSchedulerService } from '../metrics/jmx-scheduler.service.js';
import { MonitoringOverviewService } from '../metrics/monitoring-overview.service.js';
import { MultiServerService } from '../server-process/multi-server.service.js';
import { SpecializedContextMapper } from './specialized-context.mapper.js';

/**
 * Aggregation service for JVM diagnostics workbench.
 *
 * Converges:
 *  - JvmCapabilityFacade   (JMX snapshots, JFR tasks, helper status)
 *  - MonitoringOverviewService (probe + JMX signals, alert summary)
 *  - JmxSchedulerService   (active JMX schedules)
 *
 * Produces a single JvmDiagnosticsSummaryDto for the workbench UI.
 */
@Injectable()
export class JvmDiagnosticsService {
  private readonly logger = new Logger(JvmDiagnosticsService.name);

  constructor(
    private readonly jvmFacade: JvmCapabilityFacade,
    private readonly jmxScheduler: JmxSchedulerService,
    private readonly monitoringOverview: MonitoringOverviewService,
    private readonly multiServer: MultiServerService,
    private readonly contextMapper: SpecializedContextMapper,
  ) {}

  /**
   * Build a JVM diagnostics summary for a managed server.
   */
  async buildSummary(serverId: string): Promise<JvmDiagnosticsSummaryDto> {
    const server = await this.multiServer.getServer(serverId);
    if (!server) {
      throw new NotFoundException(`Server ${serverId} not found`);
    }

    // Parallel data gathering
    const [monitoring, latestJmx, helperStatus, jfrTasks] = await Promise.all([
      this.monitoringOverview.getOverview(serverId).catch((err): MonitoringOverviewDto | null => {
        this.logger.warn(`Failed to get monitoring overview for ${serverId}: ${err}`);
        return null;
      }),
      this.jvmFacade.getLatestJmx(serverId).catch((): JmxMetricSnapshotDto | undefined => undefined),
      this.jvmFacade.getStatus().catch((): { state: string; attachedPid?: string } => ({ state: 'UNKNOWN' })),
      this.jvmFacade.listJfrTasks(serverId).catch((): readonly JfrTaskDto[] => []),
    ]);

    // Build target descriptor
    const target: JvmTargetDto = {
      kind: 'managed-server',
      serverId,
      serverName: server.name,
      hostId: server.id,
    };

    // Derive risk signals from monitoring signals + JFR state
    const riskSignals = this.deriveRiskSignals(monitoring, jfrTasks);

    // Derive health state
    const healthState = this.resolveHealthState(monitoring, riskSignals);

    // Helper attach state
    const helperAttached =
      helperStatus.state === 'ATTACHED' ||
      (helperStatus.attachedPid != null && helperStatus.attachedPid !== '');

    // JMX connectivity — we have a recent snapshot
    const jmxConnected = latestJmx != null;

    // Active JFR recordings
    const activeJfrRecordings = jfrTasks.filter((t) => t.status === 'running');

    // Uptime from monitoring
    const uptimeSeconds = monitoring?.latestProbe?.timestamp
      ? Math.floor(
          (Date.now() - Date.parse(monitoring.latestProbe.timestamp)) / 1000,
        )
      : null;

    return {
      target,
      generatedAt: new Date().toISOString(),
      healthState,
      latestJmx: latestJmx ?? null,
      activeJfrRecordings,
      riskSignals,
      recentActions: [],
      helperAttached,
      jmxConnected,
      uptimeSeconds,
    };
  }

  // ── private helpers ──────────────────────────────────────────

  private deriveRiskSignals(
    monitoring: MonitoringOverviewDto | null,
    jfrTasks: readonly JfrTaskDto[],
  ): JvmRiskSignalDto[] {
    const signals: JvmRiskSignalDto[] = [];
    const now = new Date().toISOString();

    if (monitoring) {
      for (const sig of monitoring.signals) {
        const riskType = this.mapSignalToRiskType(sig.source, sig.metric);
        if (riskType) {
          signals.push({
            type: riskType,
            level: sig.level,
            message: sig.message,
            detectedAt: now,
            value: sig.value,
            threshold: sig.threshold,
          });
        }
      }
    }

    // Check for JFR recording failures
    for (const task of jfrTasks) {
      if (task.status === 'failed') {
        signals.push({
          type: 'jfr-recording-failed',
          level: 'WARNING',
          message: `JFR recording failed: ${task.error ?? 'unknown error'}`,
          detectedAt: task.endedAt ?? task.startedAt,
          value: null,
          threshold: null,
        });
      }
    }

    // Sort by severity
    const severityOrder: Record<string, number> = { CRITICAL: 3, WARNING: 2, INFO: 1 };
    signals.sort((a, b) => (severityOrder[b.level] ?? 0) - (severityOrder[a.level] ?? 0));

    return signals;
  }

  private mapSignalToRiskType(
    source: 'probe' | 'jmx' | 'alert',
    metric: string,
  ): JvmRiskSignalType | null {
    switch (metric) {
      case 'CPU_USAGE':
        return 'high-cpu';
      case 'MEMORY_USAGE':
      case 'HEAP_USED_MB':
      case 'HEAP_USED_RATIO':
        return 'high-memory';
      case 'THREAD_COUNT':
        return 'thread-contention';
      case 'GC_PRESSURE':
        return 'gc-pressure';
      default:
        return null;
    }
  }

  private resolveHealthState(
    monitoring: MonitoringOverviewDto | null,
    riskSignals: readonly JvmRiskSignalDto[],
  ): JvmHealthState {
    if (monitoring) {
      switch (monitoring.state) {
        case 'critical':
          return 'critical';
        case 'degraded':
          return 'degraded';
        case 'healthy':
          return riskSignals.length > 0 ? 'degraded' : 'healthy';
      }
    }

    if (riskSignals.length === 0) return 'unknown';
    if (riskSignals.some((s) => s.level === 'CRITICAL')) return 'critical';
    return 'degraded';
  }
}
