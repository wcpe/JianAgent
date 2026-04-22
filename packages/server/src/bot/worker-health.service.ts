import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { WorkerRegistryService } from './worker-registry.service.js';

@Injectable()
export class WorkerHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerHealthService.name);
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  /** 30s without heartbeat → unhealthy */
  private readonly HEARTBEAT_TIMEOUT_MS = 30_000;
  /** 90s without heartbeat → offline */
  private readonly OFFLINE_TIMEOUT_MS = 90_000;
  /** check every 10s */
  private readonly CHECK_INTERVAL_MS = 10_000;

  constructor(private readonly registry: WorkerRegistryService) {}

  onModuleInit(): void {
    this.checkInterval = setInterval(() => this.checkAll(), this.CHECK_INTERVAL_MS);
    this.logger.log('Worker health check started');
  }

  onModuleDestroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  checkAll(): void {
    const now = Date.now();
    const workers = this.registry.listWorkers();

    for (const worker of workers) {
      if (worker.status === 'offline') continue;

      const elapsed = now - worker.lastHeartbeat;

      if (elapsed > this.OFFLINE_TIMEOUT_MS) {
        this.registry.markOffline(worker.workerId);
        this.logger.warn(
          `Worker ${worker.workerId} marked OFFLINE (no heartbeat for ${elapsed}ms)`,
        );
      } else if (elapsed > this.HEARTBEAT_TIMEOUT_MS && worker.status === 'online') {
        this.registry.markUnhealthy(worker.workerId);
        this.logger.warn(
          `Worker ${worker.workerId} marked UNHEALTHY (no heartbeat for ${elapsed}ms)`,
        );
      }
    }
  }
}
