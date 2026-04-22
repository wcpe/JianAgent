import { Injectable, Logger } from '@nestjs/common';
import type { ProbeSnapshotDto } from '@jian-agent/shared-domain';

export type ConditionType = 'no_players_for' | 'after_session' | 'memory_exceeds';

export interface StopCondition {
  readonly type: ConditionType;
  readonly params: Readonly<Record<string, number>>;
}

interface ConditionState {
  readonly condition: StopCondition;
  readonly noPlayersSince: number | null;
}

@Injectable()
export class ConditionalStopService {
  private readonly conditions = new Map<string, ConditionState>();
  private readonly logger = new Logger(ConditionalStopService.name);
  private onStopTriggered: ((serverId: string, reason: string) => void) | null = null;

  setStopCallback(cb: (serverId: string, reason: string) => void): void {
    this.onStopTriggered = cb;
  }

  setCondition(serverId: string, condition: StopCondition): void {
    this.conditions.set(serverId, { condition, noPlayersSince: null });
    this.logger.log(`Set condition for server ${serverId}: ${condition.type}`);
  }

  clearCondition(serverId: string): void {
    this.conditions.delete(serverId);
    this.logger.log(`Cleared condition for server ${serverId}`);
  }

  getCondition(serverId: string): StopCondition | null {
    return this.conditions.get(serverId)?.condition ?? null;
  }

  evaluateSnapshot(serverId: string, snapshot: ProbeSnapshotDto): void {
    const entry = this.conditions.get(serverId);
    if (!entry) return;

    const { condition } = entry;

    switch (condition.type) {
      case 'no_players_for': {
        const minutes = condition.params['minutes'] ?? 10;
        const onlinePlayers = snapshot.onlinePlayers ?? 0;

        if (onlinePlayers === 0) {
          const since = entry.noPlayersSince ?? Date.now();
          const elapsed = (Date.now() - since) / 60_000;
          this.conditions.set(serverId, { ...entry, noPlayersSince: since });

          if (elapsed >= minutes) {
            this.triggerStop(serverId, `No players for ${minutes} minutes`);
          }
        } else {
          this.conditions.set(serverId, { ...entry, noPlayersSince: null });
        }
        break;
      }
      case 'memory_exceeds': {
        const thresholdMb = condition.params['thresholdMb'] ?? 4096;
        const memUsage = (snapshot.totalMemoryMb ?? 0) - (snapshot.freeMemoryMb ?? 0);

        if (memUsage > thresholdMb) {
          this.triggerStop(serverId, `Memory usage ${memUsage}MB exceeds threshold ${thresholdMb}MB`);
        }
        break;
      }
      default:
        break;
    }
  }

  onSessionEnded(serverId: string): void {
    const entry = this.conditions.get(serverId);
    if (!entry || entry.condition.type !== 'after_session') return;

    this.triggerStop(serverId, 'Session ended (after_session condition)');
  }

  private triggerStop(serverId: string, reason: string): void {
    this.logger.warn(`Conditional stop triggered for ${serverId}: ${reason}`);
    this.conditions.delete(serverId);
    this.onStopTriggered?.(serverId, reason);
  }
}
