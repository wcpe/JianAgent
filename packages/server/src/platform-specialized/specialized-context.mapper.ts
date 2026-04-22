import { Injectable } from '@nestjs/common';
import type {
  JvmTargetDto,
  JvmDiagnosticActionDto,
  MonitoringSignalDto,
  JvmRiskSignalDto,
  JvmRiskSignalType,
  AlertLevel,
  MetricSnapshotDto,
  JmxMetricSnapshotDto,
} from '@jian-agent/shared-domain';

/**
 * Mapper for platform-specialized workbench context.
 *
 * Normalises data from multiple sources (JVM, probe, monitoring)
 * into workbench-ready DTOs and performs cross-domain value conversions.
 */
@Injectable()
export class SpecializedContextMapper {

  // ── Target resolution ───────────────────────────────────────

  /**
   * Build a ManagedServerTargetDto from raw server metadata.
   */
  toManagedTarget(serverId: string, serverName: string, hostId: string): JvmTargetDto {
    return {
      kind: 'managed-server',
      serverId,
      serverName,
      hostId,
    };
  }

  /**
   * Build an ExternalPidTargetDto from raw fields.
   */
  toExternalPidTarget(pid: string, hostId: string, mainClass?: string): JvmTargetDto {
    return {
      kind: 'external-pid',
      pid,
      hostId,
      mainClass,
    };
  }

  // ── Risk signal mapping ─────────────────────────────────────

  /**
   * Map a monitoring signal to a JVM risk signal type, or null if unrelated.
   */
  mapMonitoringSignalToRisk(signal: MonitoringSignalDto): JvmRiskSignalDto | null {
    const riskType = this.inferRiskType(signal.source, signal.metric);
    if (!riskType) return null;

    return {
      type: riskType,
      level: signal.level,
      message: signal.message,
      detectedAt: new Date().toISOString(),
      value: signal.value,
      threshold: signal.threshold,
    };
  }

  /**
   * Map an array of monitoring signals to risk signals, filtering out unrelated ones.
   */
  mapMonitoringSignalsToRisks(signals: readonly MonitoringSignalDto[]): JvmRiskSignalDto[] {
    return signals
      .map((s) => this.mapMonitoringSignalToRisk(s))
      .filter((r): r is JvmRiskSignalDto => r !== null);
  }

  // ── Health state derivation ─────────────────────────────────

  /**
   * Compute a health state from risk signals.
   */
  deriveHealthState(riskSignals: readonly JvmRiskSignalDto[]): 'healthy' | 'degraded' | 'critical' | 'unknown' {
    if (riskSignals.length === 0) return 'healthy';
    if (riskSignals.some((s) => s.level === 'CRITICAL')) return 'critical';
    return 'degraded';
  }

  // ── Metric summaries ────────────────────────────────────────

  /**
   * Extract a compact performance summary from a probe snapshot.
   */
  extractPerfSummary(snapshot: MetricSnapshotDto | null | undefined): {
    tps: number | null;
    mspt: number | null;
    cpuPercent: number | null;
    memoryPercent: number | null;
    onlinePlayers: number | null;
  } {
    if (!snapshot) {
      return { tps: null, mspt: null, cpuPercent: null, memoryPercent: null, onlinePlayers: null };
    }

    const memoryPercent =
      typeof snapshot.memoryUsageMb === 'number' && typeof snapshot.maxMemoryMb === 'number' && snapshot.maxMemoryMb > 0
        ? (snapshot.memoryUsageMb / snapshot.maxMemoryMb) * 100
        : null;

    return {
      tps: snapshot.tps,
      mspt: snapshot.mspt,
      cpuPercent: snapshot.cpuUsage,
      memoryPercent,
      onlinePlayers: snapshot.onlinePlayers,
    };
  }

  /**
   * Extract a compact JVM memory summary from a JMX snapshot.
   */
  extractJvmMemorySummary(snapshot: JmxMetricSnapshotDto | null | undefined): {
    heapUsedMb: number | null;
    heapMaxMb: number | null;
    heapUsagePercent: number | null;
    threadCount: number | null;
  } {
    if (!snapshot) {
      return { heapUsedMb: null, heapMaxMb: null, heapUsagePercent: null, threadCount: null };
    }

    const heapUsagePercent =
      typeof snapshot.heapUsedMb === 'number' && typeof snapshot.heapMaxMb === 'number' && snapshot.heapMaxMb > 0
        ? (snapshot.heapUsedMb / snapshot.heapMaxMb) * 100
        : null;

    return {
      heapUsedMb: snapshot.heapUsedMb,
      heapMaxMb: snapshot.heapMaxMb,
      heapUsagePercent,
      threadCount: snapshot.threadCount,
    };
  }

  // ── Private ─────────────────────────────────────────────────

  private inferRiskType(
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
}
