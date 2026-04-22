import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProcessManagerService } from './process-manager.service.js';
import { DEFAULTS } from '@jian-agent/shared-domain';
import type { ServerStatusPayload } from '@jian-agent/shared-protocol';

interface MonitorTickPayload extends ServerStatusPayload {
  readonly serverId: string;
}

@Injectable()
export class ProcessMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProcessMonitorService.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private readonly lastStatuses = new Map<string, ServerStatusPayload>();

  constructor(
    private readonly processManager: ProcessManagerService,
    private readonly eventBus: EventEmitter2,
  ) {}

  onModuleInit(): void {
    this.intervalHandle = setInterval(() => {
      this.poll();
    }, DEFAULTS.MONITOR_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
  }

  getLastStatus(serverId = 'default'): ServerStatusPayload | null {
    return this.lastStatuses.get(serverId) ?? null;
  }

  private poll(): void {
    const managedServerIds = this.processManager.getManagedServerIds();
    const serverIds = managedServerIds.length > 0 ? managedServerIds : ['default'];

    for (const serverId of serverIds) {
      const status = this.processManager.getStatus(serverId);
      this.lastStatuses.set(serverId, status);
      const payload: MonitorTickPayload = { ...status, serverId };
      this.eventBus.emit('monitor-tick', payload);
    }
  }
}
