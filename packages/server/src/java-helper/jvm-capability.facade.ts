import { Injectable, Logger } from '@nestjs/common';
import type { JmxMetricSnapshotDto, JmxMetricBucketDto, JfrTaskDto } from '@jian-agent/shared-domain';
import { ServerState } from '@jian-agent/shared-domain';
import { JavaHelperService } from './java-helper.service.js';
import { JfrTaskService } from './jfr-task.service.js';
import { ProcessAttachService } from '../server-process/process-attach.service.js';
import { ProcessManagerService } from '../server-process/process-manager.service.js';
import { MetricStoreService } from '../storage/metric-store.service.js';

function toNumber(input: unknown): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string' && input.trim() !== '') {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: readonly string[]): number | null {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of keys) {
    const value = toNumber(obj[key]);
    if (value !== null) return value;
  }
  return null;
}

function averageNumber(values: readonly (number | null)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

export interface JvmTarget {
  serverId?: string;
  pid?: string | number;
}

/**
 * Facade that converges JavaHelper, JMX, JFR, and Attach interfaces.
 *
 * Provides unified target resolution and single entry point for all JVM-related
 * capabilities.  Keeps existing API routes compatible while routing internally
 * through this facade.
 */
@Injectable()
export class JvmCapabilityFacade {
  private readonly logger = new Logger(JvmCapabilityFacade.name);

  constructor(
    private readonly javaHelper: JavaHelperService,
    private readonly jfrTaskService: JfrTaskService,
    private readonly processAttach: ProcessAttachService,
    private readonly processManager: ProcessManagerService,
    private readonly metricStore: MetricStoreService,
  ) {}

  // ────────────────────────────────────────────────────────────
  // Target resolution helpers
  // ────────────────────────────────────────────────────────────

  /**
   * Resolve the PID for a given target.
   * Supports explicit PID or lookup by serverId.
   */
  resolvePid(target: JvmTarget): string | number | undefined {
    if (target.pid !== undefined) {
      return typeof target.pid === 'string' ? target.pid : target.pid;
    }
    if (target.serverId) {
      const status = this.processManager.getStatus(target.serverId);
      return status.pid;
    }
    // Fallback: check ProcessAttachService for attached PID
    const attached = this.processAttach.getAttachedPid(target.serverId);
    return attached;
  }

  /**
   * Resolve the PID as a string (for java-helper commands).
   */
  resolvePidString(target: JvmTarget): string | undefined {
    const pid = this.resolvePid(target);
    return pid !== undefined ? String(pid) : undefined;
  }

  /**
   * Resolve serverId with fallback to 'default'.
   */
  resolveServerId(target: JvmTarget): string {
    return target.serverId ?? 'default';
  }

  // ────────────────────────────────────────────────────────────
  // JavaHelper operations (attach/detach/sampling)
  // ────────────────────────────────────────────────────────────

  async getStatus(): Promise<{ state: string; attachedPid?: string }> {
    return this.javaHelper.getStatus();
  }

  async startHelper(): Promise<void> {
    return this.javaHelper.start();
  }

  async resolveHelper(): Promise<any> {
    return this.javaHelper.resolve();
  }

  async attachToTarget(target: JvmTarget): Promise<any> {
    const pid = this.resolvePidString(target);
    if (!pid) {
      throw new Error(`Cannot resolve PID for target: ${JSON.stringify(target)}`);
    }
    return this.javaHelper.attach(pid);
  }

  async detachFromTarget(): Promise<any> {
    return this.javaHelper.detach();
  }

  async sampleThreads(): Promise<any> {
    return this.javaHelper.sampleThreads();
  }

  async sampleHeap(): Promise<any> {
    return this.javaHelper.sampleHeap();
  }

  async sendCommand(type: string, params: Record<string, unknown> = {}): Promise<any> {
    return this.javaHelper.sendCommand(type, params);
  }

  async scanJar(jarPath: string): Promise<{
    readonly entryClasses: ReadonlyArray<{ className: string; isMainClass: boolean; source: string }>;
    readonly manifest: Record<string, string>;
    readonly totalClasses: number;
  }> {
    return this.javaHelper.scanJar(jarPath);
  }

  async recommendJvmArgs(jarPath: string, maxMemoryMb?: number): Promise<{
    readonly recommended: readonly string[];
    readonly explanation: readonly string[];
  }> {
    return this.javaHelper.recommendJvmArgs(jarPath, maxMemoryMb);
  }

  get helperReady(): boolean {
    return this.javaHelper.isReady;
  }

  get helperState(): string {
    return this.javaHelper.currentState;
  }

  // ────────────────────────────────────────────────────────────
  // Process attach operations
  // ────────────────────────────────────────────────────────────

  async attachProcess(serverIdOrPid: string | number, maybePid?: number): Promise<{ success: boolean; state: ServerState }> {
    return this.processAttach.attachByPid(serverIdOrPid, maybePid);
  }

  getAttachedPid(serverId?: string): number | undefined {
    return this.processAttach.getAttachedPid(serverId);
  }

  detachProcess(serverId?: string): void {
    this.processAttach.detach(serverId);
  }

  // ────────────────────────────────────────────────────────────
  // JFR operations
  // ────────────────────────────────────────────────────────────

  async startJfrTask(input: {
    serverId: string;
    pid: string;
    durationSec?: number;
    settings?: 'default' | 'profile';
  }): Promise<JfrTaskDto> {
    return this.jfrTaskService.startTask(input);
  }

  async stopJfrTask(taskId: string): Promise<JfrTaskDto> {
    return this.jfrTaskService.stopTask(taskId);
  }

  async listJfrTasks(serverId?: string): Promise<readonly JfrTaskDto[]> {
    return this.jfrTaskService.listTasks(serverId);
  }

  async getJfrTask(taskId: string): Promise<JfrTaskDto | undefined> {
    return this.jfrTaskService.getTask(taskId);
  }

  async getJfrDownloadPayload(taskId: string): Promise<{ fileName: string; contentBase64: string }> {
    return this.jfrTaskService.getDownloadPayload(taskId);
  }

  async getJfrDownloadStreamMeta(taskId: string): Promise<{ fileName: string; filePath: string; sizeBytes: number }> {
    return this.jfrTaskService.getDownloadStreamMeta(taskId);
  }

  async cleanupJfrTasks(retentionDays: number): Promise<{ deletedTasks: number; deletedFiles: number }> {
    return this.jfrTaskService.cleanupOldTasks(retentionDays);
  }

  // ────────────────────────────────────────────────────────────
  // JMX metrics operations
  // ────────────────────────────────────────────────────────────

  async collectJmxSnapshot(target: JvmTarget): Promise<JmxMetricSnapshotDto> {
    const serverId = this.resolveServerId(target);
    const pid = this.resolvePidString(target);
    if (!pid) {
      throw new Error(`Cannot resolve PID for target: ${JSON.stringify(target)}`);
    }

    let attached = false;
    try {
      await this.javaHelper.attach(pid);
      attached = true;

      let jmxRaw: unknown = null;
      try {
        jmxRaw = await this.javaHelper.sendCommand('sample-jmx');
      } catch (err) {
        this.logger.debug('sample-jmx command failed', err);
        jmxRaw = null;
      }

      const heapRaw = await this.javaHelper.sampleHeap();
      const threadRaw = await this.javaHelper.sampleThreads();

      const heapObj = (heapRaw != null && typeof heapRaw === 'object' ? heapRaw : {}) as Record<string, unknown>;
      const threadObj = (threadRaw != null && typeof threadRaw === 'object' ? threadRaw : {}) as Record<string, unknown>;

      const jmxObj = (jmxRaw != null && typeof jmxRaw === 'object' ? jmxRaw : {}) as Record<string, unknown>;
      const payload = ((jmxObj.data ?? jmxRaw ?? {}) as Record<string, unknown>);
      const heapPayload = (heapObj.data ?? heapRaw ?? {}) as Record<string, unknown>;
      const threadPayload = (threadObj.data ?? threadRaw ?? {}) as Record<string, unknown>;

      const base: Omit<JmxMetricSnapshotDto, 'id'> = {
        timestamp: new Date().toISOString(),
        serverId,
        pid,
        heapUsedMb: pickNumber(payload, ['heapUsedMb', 'usedMb']) ?? pickNumber(heapPayload, ['usedMb', 'heapUsedMb']),
        heapCommittedMb: pickNumber(payload, ['heapCommittedMb', 'committedMb']) ?? pickNumber(heapPayload, ['committedMb', 'heapCommittedMb']),
        heapMaxMb: pickNumber(payload, ['heapMaxMb', 'maxMb']) ?? pickNumber(heapPayload, ['maxMb', 'heapMaxMb']),
        threadCount: pickNumber(payload, ['threadCount']) ?? pickNumber(threadPayload, ['threadCount', 'totalThreads']),
        daemonThreadCount: pickNumber(payload, ['daemonThreadCount']) ?? pickNumber(threadPayload, ['daemonThreadCount', 'daemonThreads']),
        gcYoungCount: pickNumber(payload, ['gcYoungCount']),
        gcFullCount: pickNumber(payload, ['gcFullCount']),
        gcYoungTimeMs: pickNumber(payload, ['gcYoungTimeMs']),
        gcFullTimeMs: pickNumber(payload, ['gcFullTimeMs']),
      };

      const id = await this.metricStore.insertJmx(base);
      const snapshot: JmxMetricSnapshotDto = { id, ...base };
      return snapshot;
    } finally {
      if (attached) {
        try {
          await this.javaHelper.detach();
        } catch (err) {
          this.logger.debug('Best-effort detach after JMX collection failed', err);
        }
      }
    }
  }

  async getLatestJmx(serverId: string): Promise<JmxMetricSnapshotDto | undefined> {
    return this.metricStore.getLatestJmx(serverId);
  }

  async getJmxHistory(input: {
    serverId: string;
    startTime: string;
    endTime: string;
    limit?: number;
  }): Promise<readonly JmxMetricSnapshotDto[]> {
    return this.metricStore.queryJmxRange(
      input.serverId,
      input.startTime,
      input.endTime,
      input.limit ?? 60,
    );
  }

  async getAggregatedJmxHistory(input: {
    serverId: string;
    startTime: string;
    endTime: string;
    intervalSec: number;
    limit?: number;
  }): Promise<readonly JmxMetricBucketDto[]> {
    const intervalMs = Math.max(1, Math.floor(input.intervalSec)) * 1000;
    const raw = await this.metricStore.queryJmxRange(
      input.serverId,
      input.startTime,
      input.endTime,
      input.limit ?? 2000,
    );

    const buckets = new Map<number, JmxMetricSnapshotDto[]>();
    for (const item of raw) {
      const ts = Date.parse(item.timestamp);
      if (!Number.isFinite(ts)) continue;
      const bucketStartMs = Math.floor(ts / intervalMs) * intervalMs;
      const list = buckets.get(bucketStartMs) ?? [];
      list.push(item);
      buckets.set(bucketStartMs, list);
    }

    const result = [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([bucketStartMs, items]) => {
        const latest = items[items.length - 1]!;
        const bucketEndMs = bucketStartMs + intervalMs;
        return {
          timestamp: new Date(bucketStartMs).toISOString(),
          bucketStart: new Date(bucketStartMs).toISOString(),
          bucketEnd: new Date(bucketEndMs).toISOString(),
          serverId: input.serverId,
          pid: latest.pid,
          sampleCount: items.length,
          heapUsedMb: averageNumber(items.map((i) => i.heapUsedMb)),
          heapCommittedMb: averageNumber(items.map((i) => i.heapCommittedMb)),
          heapMaxMb: averageNumber(items.map((i) => i.heapMaxMb)),
          threadCount: averageNumber(items.map((i) => i.threadCount)),
          daemonThreadCount: averageNumber(items.map((i) => i.daemonThreadCount)),
          gcYoungCount: averageNumber(items.map((i) => i.gcYoungCount)),
          gcFullCount: averageNumber(items.map((i) => i.gcFullCount)),
          gcYoungTimeMs: averageNumber(items.map((i) => i.gcYoungTimeMs)),
          gcFullTimeMs: averageNumber(items.map((i) => i.gcFullTimeMs)),
        } satisfies JmxMetricBucketDto;
      });

    const maxPoints = input.limit ?? 60;
    return result.slice(-maxPoints);
  }
}
