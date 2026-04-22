import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JmxMetricsService } from './jmx-metrics.service.js';
import { AlertEngineService } from './alert-engine.service.js';

export interface JmxSchedule {
  readonly id: string;
  readonly serverId: string;
  readonly pid: string;
  readonly intervalSec: number;
  readonly heapUsedThresholdMb?: number;
  readonly threadThreshold?: number;
  readonly createdAt: string;
}

interface RuntimeSchedule {
  readonly config: JmxSchedule;
  readonly timer: ReturnType<typeof setInterval>;
}

@Injectable()
export class JmxSchedulerService implements OnModuleDestroy {
  private readonly schedules = new Map<string, RuntimeSchedule>();

  constructor(
    private readonly jmxMetricsService: JmxMetricsService,
    private readonly alertEngine: AlertEngineService,
  ) {}

  async createSchedule(input: {
    serverId: string;
    pid: string;
    intervalSec: number;
    heapUsedThresholdMb?: number;
    threadThreshold?: number;
  }): Promise<JmxSchedule> {
    const config: JmxSchedule = {
      id: randomUUID(),
      serverId: input.serverId,
      pid: input.pid,
      intervalSec: Math.max(5, input.intervalSec),
      heapUsedThresholdMb: input.heapUsedThresholdMb,
      threadThreshold: input.threadThreshold,
      createdAt: new Date().toISOString(),
    };

    const timer = setInterval(async () => {
      const snapshot = await this.jmxMetricsService.collectSnapshot({
        serverId: config.serverId,
        pid: config.pid,
      });

      if (
        typeof config.heapUsedThresholdMb === 'number' &&
        typeof snapshot.heapUsedMb === 'number' &&
        snapshot.heapUsedMb > config.heapUsedThresholdMb
      ) {
        await this.alertEngine.fireJmxThresholdAlert({
          serverId: config.serverId,
          metric: 'HEAP_USED_MB',
          value: snapshot.heapUsedMb,
          threshold: config.heapUsedThresholdMb,
        });
      }

      if (
        typeof config.threadThreshold === 'number' &&
        typeof snapshot.threadCount === 'number' &&
        snapshot.threadCount > config.threadThreshold
      ) {
        await this.alertEngine.fireJmxThresholdAlert({
          serverId: config.serverId,
          metric: 'THREAD_COUNT',
          value: snapshot.threadCount,
          threshold: config.threadThreshold,
        });
      }
    }, config.intervalSec * 1000);

    this.schedules.set(config.id, { config, timer });
    return config;
  }

  removeSchedule(id: string): boolean {
    const runtime = this.schedules.get(id);
    if (!runtime) return false;
    clearInterval(runtime.timer);
    this.schedules.delete(id);
    return true;
  }

  listSchedules(): readonly JmxSchedule[] {
    return [...this.schedules.values()].map((item) => item.config);
  }

  onModuleDestroy(): void {
    for (const runtime of this.schedules.values()) {
      clearInterval(runtime.timer);
    }
    this.schedules.clear();
  }
}
