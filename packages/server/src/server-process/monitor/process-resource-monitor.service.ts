import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ProcessMetrics } from '@jian-agent/shared-domain';
import { ProcessMetricsStore } from './process-metrics.store.js';

@Injectable()
export class ProcessResourceMonitor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProcessResourceMonitor.name);
  private readonly monitored = new Map<string, { serverId: string; pid: number }>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private static readonly POLL_INTERVAL = 5_000;

  constructor(
    private readonly store: ProcessMetricsStore,
    private readonly eventBus: EventEmitter2,
  ) {}

  onModuleInit(): void {
    this.pollTimer = setInterval(() => void this.pollAll(), ProcessResourceMonitor.POLL_INTERVAL);
  }

  onModuleDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  startMonitoring(serverId: string, pid: number): void {
    this.monitored.set(serverId, { serverId, pid });
    this.logger.log(`Started monitoring ${serverId} (pid=${pid})`);
  }

  stopMonitoring(serverId: string): void {
    this.monitored.delete(serverId);
  }

  isMonitoring(serverId: string): boolean {
    return this.monitored.has(serverId);
  }

  async collectOnce(serverId: string): Promise<ProcessMetrics | null> {
    const entry = this.monitored.get(serverId);
    if (!entry) return null;
    return this.collectForPid(entry.serverId, entry.pid);
  }

  private async pollAll(): Promise<void> {
    for (const [serverId, entry] of this.monitored) {
      try {
        const metrics = await this.collectForPid(serverId, entry.pid);
        if (metrics) {
          await this.store.save(metrics);
          this.eventBus.emit('server.process-metric', metrics);
        }
      } catch (err) {
        this.logger.warn(`Failed to collect metrics for ${serverId}: ${err}`);
      }
    }
  }

  private async collectForPid(serverId: string, pid: number): Promise<ProcessMetrics | null> {
    try {
      const pidusage = (await import('pidusage')).default;
      const stats = await pidusage(pid);

      return {
        serverId,
        timestamp: new Date().toISOString(),
        cpuPercent: stats.cpu,
        rssBytes: stats.memory,
        threadCount: undefined,
        fdCount: undefined,
      };
    } catch (err) {
      this.logger.debug(`Failed to collect pidusage for pid ${pid}`, err);
      return null;
    }
  }
}