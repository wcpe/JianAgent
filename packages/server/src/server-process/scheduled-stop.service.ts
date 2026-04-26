import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface ScheduledStop {
  readonly serverId: string;
  readonly stopAt: Date;
  readonly mode: 'graceful' | 'force';
  readonly reason: 'manual' | 'scheduled-restart';
  readonly timer: NodeJS.Timeout;
  readonly warningTimers: readonly NodeJS.Timeout[];
  readonly executionId: string;
}

@Injectable()
export class ScheduledStopService {
  private readonly scheduled = new Map<string, ScheduledStop>();
  private readonly lastStopReason = new Map<string, 'manual' | 'scheduled-restart'>();
  private readonly logger = new Logger(ScheduledStopService.name);

  constructor(
    private readonly eventBus: EventEmitter2,
  ) {}

  schedule(
    serverId: string,
    stopAt: Date,
    mode: 'graceful' | 'force',
    reason: 'manual' | 'scheduled-restart' = 'manual',
    idempotencyKey?: string,
  ): void {
    this.cancel(serverId);

    const now = Date.now();
    const stopDelay = stopAt.getTime() - now;
    const executionId = this.buildExecutionId(serverId, reason, mode, stopAt, idempotencyKey);

    if (stopDelay <= 0) {
      this.logger.warn(`Scheduled stop time is in the past for server ${serverId}, stopping immediately`);
      this.executeStop(serverId, mode, reason, executionId);
      return;
    }

    const warningTimers: NodeJS.Timeout[] = [];

    // Warning 60s before
    const warn60 = stopDelay - 60_000;
    if (warn60 > 0) {
      warningTimers.push(
        setTimeout(() => {
          this.logger.warn(`Server ${serverId} will stop in 60 seconds`);
          this.eventBus.emit('scheduled-stop-warning', { serverId, secondsLeft: 60, reason });
        }, warn60),
      );
    }

    // Warning 10s before
    const warn10 = stopDelay - 10_000;
    if (warn10 > 0) {
      warningTimers.push(
        setTimeout(() => {
          this.logger.warn(`Server ${serverId} will stop in 10 seconds`);
          this.eventBus.emit('scheduled-stop-warning', { serverId, secondsLeft: 10, reason });
        }, warn10),
      );
    }

    const timer = setTimeout(() => {
      this.executeStop(serverId, mode, reason, executionId);
      this.scheduled.delete(serverId);
    }, stopDelay);

    this.scheduled.set(serverId, {
      serverId,
      stopAt,
      mode,
      reason,
      timer,
      warningTimers,
      executionId,
    });

    this.logger.log(`Scheduled ${mode} stop for server ${serverId} at ${stopAt.toISOString()} (reason: ${reason})`);
  }

  cancel(serverId: string): boolean {
    const existing = this.scheduled.get(serverId);
    if (!existing) return false;

    clearTimeout(existing.timer);
    for (const wt of existing.warningTimers) {
      clearTimeout(wt);
    }
    this.scheduled.delete(serverId);
    this.logger.log(`Cancelled scheduled stop for server ${serverId}`);
    return true;
  }

  getScheduled(serverId: string): { readonly stopAt: string; readonly mode: string; readonly reason: string } | null {
    const entry = this.scheduled.get(serverId);
    if (!entry) return null;
    return {
      stopAt: entry.stopAt.toISOString(),
      mode: entry.mode,
      reason: entry.reason,
    };
  }

  getLastStopReason(serverId: string): 'manual' | 'scheduled-restart' | null {
    return this.lastStopReason.get(serverId) ?? null;
  }

  private buildExecutionId(
    serverId: string,
    reason: 'manual' | 'scheduled-restart',
    mode: 'graceful' | 'force',
    stopAt: Date,
    idempotencyKey?: string,
  ): string {
    const normalizedKey = idempotencyKey?.trim();
    if (!normalizedKey) {
      return `${serverId}::${reason}::${mode}::${stopAt.getTime()}`;
    }

    return `${serverId}::${reason}::${mode}::${stopAt.getTime()}::${normalizedKey}`;
  }

  private executeStop(
    serverId: string,
    mode: 'graceful' | 'force',
    reason: 'manual' | 'scheduled-restart',
    executionId: string,
  ): void {
    this.logger.log(`Executing ${mode} stop for server ${serverId} (reason: ${reason})`);
    this.lastStopReason.set(serverId, reason);
    if (reason === 'scheduled-restart') {
      this.eventBus.emit('scheduled-restart-stop', { serverId, executionId });
    } else if (mode === 'force') {
      this.eventBus.emit('force-stop-requested', { serverId, executionId });
    } else {
      this.eventBus.emit('graceful-stop-requested', { serverId, executionId });
    }
  }
}
