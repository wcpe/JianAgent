import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

interface MonitoredServer {
  readonly serverId: string;
  readonly pid: number;
  readonly lastSnapshotTime: number;
}

export type HealthEvent = {
  readonly type: 'pid-changed' | 'unresponsive' | 'recovered';
  readonly serverId: string;
  readonly detail: string;
};

interface ResourceTracker {
  cpuHighSince: number | null;
  memHighSince: number | null;
}

@Injectable()
export class HealthMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HealthMonitorService.name);
  private interval: NodeJS.Timeout | null = null;
  private readonly monitored = new Map<string, MonitoredServer>();
  private readonly unresponsiveSet = new Set<string>();
  private readonly resourceTrackers = new Map<string, ResourceTracker>();
  private readonly POLL_INTERVAL = 5_000;
  private readonly UNRESPONSIVE_THRESHOLD = 30_000;

  // Configurable thresholds
  private cpuHighThreshold = 90;          // percent
  private cpuSustainedMs = 60_000;        // how long before alerting
  private memoryHighThreshold = 80;       // percent
  private memorySustainedMs = 120_000;

  private onHealthEvent: ((event: HealthEvent) => void) | null = null;

  setEventCallback(cb: (event: HealthEvent) => void): void {
    this.onHealthEvent = cb;
  }

  onModuleInit(): void {
    this.interval = setInterval(() => this.check(), this.POLL_INTERVAL);
    this.logger.log('Health monitor started');
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  startMonitoring(serverId: string, pid: number): void {
    this.monitored.set(serverId, { serverId, pid, lastSnapshotTime: Date.now() });
    this.unresponsiveSet.delete(serverId);
  }

  stopMonitoring(serverId: string): void {
    this.monitored.delete(serverId);
    this.unresponsiveSet.delete(serverId);
    this.resourceTrackers.delete(serverId);
  }

  onMetricsReceived(serverId: string, cpuPercent: number, rssPercent: number): void {
    const now = Date.now();
    let tracker = this.resourceTrackers.get(serverId);
    if (!tracker) {
      tracker = { cpuHighSince: null, memHighSince: null };
      this.resourceTrackers.set(serverId, tracker);
    }

    // Track sustained high CPU
    if (cpuPercent >= this.cpuHighThreshold) {
      if (!tracker.cpuHighSince) tracker.cpuHighSince = now;
      const duration = now - tracker.cpuHighSince;
      if (duration >= this.cpuSustainedMs) {
        this.emitEvent({
          type: 'unresponsive',
          serverId,
          detail: `CPU sustained at ${cpuPercent.toFixed(1)}% for ${Math.round(duration / 1000)}s`,
        });
        tracker.cpuHighSince = now; // reset to avoid repeated alerts
      }
    } else {
      tracker.cpuHighSince = null;
    }

    // Track sustained high memory
    if (rssPercent >= this.memoryHighThreshold) {
      if (!tracker.memHighSince) tracker.memHighSince = now;
      const duration = now - tracker.memHighSince;
      if (duration >= this.memorySustainedMs) {
        this.emitEvent({
          type: 'unresponsive',
          serverId,
          detail: `Memory sustained at ${rssPercent.toFixed(1)}% for ${Math.round(duration / 1000)}s`,
        });
        tracker.memHighSince = now; // reset to avoid repeated alerts
      }
    } else {
      tracker.memHighSince = null;
    }
  }

  onSnapshotReceived(serverId: string): void {
    const entry = this.monitored.get(serverId);
    if (!entry) return;

    this.monitored.set(serverId, { ...entry, lastSnapshotTime: Date.now() });

    // Recovered from unresponsive
    if (this.unresponsiveSet.has(serverId)) {
      this.unresponsiveSet.delete(serverId);
      this.emitEvent({ type: 'recovered', serverId, detail: 'Snapshot received again' });
    }
  }

  private check(): void {
    const now = Date.now();
    for (const [serverId, entry] of this.monitored) {
      // Check PID alive
      if (!this.isPidAlive(entry.pid)) {
        this.emitEvent({
          type: 'pid-changed',
          serverId,
          detail: `PID ${entry.pid} no longer alive`,
        });
        this.monitored.delete(serverId);
        continue;
      }

      // Check snapshot freshness
      const elapsed = now - entry.lastSnapshotTime;
      if (elapsed > this.UNRESPONSIVE_THRESHOLD && !this.unresponsiveSet.has(serverId)) {
        this.unresponsiveSet.add(serverId);
        this.emitEvent({
          type: 'unresponsive',
          serverId,
          detail: `No snapshot for ${Math.round(elapsed / 1000)}s`,
        });
      }
    }
  }

  private isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private emitEvent(event: HealthEvent): void {
    this.logger.warn(`Health event [${event.type}] server=${event.serverId}: ${event.detail}`);
    this.onHealthEvent?.(event);
  }

  getMonitoredServers(): readonly string[] {
    return [...this.monitored.keys()];
  }

  getResourceTracker(serverId: string): ResourceTracker | undefined {
    return this.resourceTrackers.get(serverId);
  }

  isUnresponsive(serverId: string): boolean {
    return this.unresponsiveSet.has(serverId);
  }
}
