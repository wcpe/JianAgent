import { Injectable } from '@nestjs/common';
import type { StateReportPayload } from '@jian-agent/shared-protocol';

export interface BotSnapshot {
  readonly name: string;
  readonly state: string;
  readonly currentBehavior: string;
  readonly workerPid: number;
  readonly serverId?: string;
  readonly batchId?: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly health: number;
  readonly food: number;
  readonly latencyMs: number;
  readonly world: string;
  readonly isDead: boolean;
  readonly deathCount: number;
  readonly connectedAt: string | null;
  readonly lastError: string | null;
  readonly lastHeartbeat: number;
}

@Injectable()
export class BotStateService {
  private readonly workerStates = new Map<number, StateReportPayload>();
  /** Bots whose worker was killed — kept so they still appear in the list as STOPPED */
  private readonly stoppedBots = new Map<string, BotSnapshot>();

  absorb(workerPid: number, report: StateReportPayload): void {
    this.workerStates.set(workerPid, report);
    // If a bot is reported by a worker, remove any stale stopped snapshot
    for (const bot of report.bots) {
      this.stoppedBots.delete(bot.name);
    }
  }

  allBots(): readonly BotSnapshot[] {
    const result: BotSnapshot[] = [];
    const seenNames = new Set<string>();
    for (const [pid, report] of this.workerStates) {
      for (const bot of report.bots) {
        const b = bot as any;
        seenNames.add(bot.name);
        result.push({
          name: bot.name,
          state: bot.state,
          currentBehavior: bot.currentBehavior,
          workerPid: pid,
          x: b.x ?? 0,
          y: b.y ?? 0,
          z: b.z ?? 0,
          health: b.health ?? 0,
          food: b.food ?? 0,
          latencyMs: b.latencyMs ?? 0,
          world: b.world ?? '',
          isDead: b.isDead ?? false,
          deathCount: b.deathCount ?? 0,
          connectedAt: b.connectedAt ?? null,
          lastError: b.lastError ?? null,
          lastHeartbeat: b.lastHeartbeat ?? 0,
        });
      }
    }
    // Append stopped bots that are not reported by any active worker
    for (const [name, snapshot] of this.stoppedBots) {
      if (!seenNames.has(name)) {
        result.push(snapshot);
      }
    }
    return result;
  }

  getBot(name: string): BotSnapshot | undefined {
    return this.allBots().find((b) => b.name === name);
  }

  removeWorker(pid: number): void {
    // Before removing, archive all bots from this worker as STOPPED
    const report = this.workerStates.get(pid);
    if (report) {
      for (const bot of report.bots) {
        const b = bot as any;
        this.stoppedBots.set(bot.name, {
          name: bot.name,
          state: 'STOPPED',
          currentBehavior: '',
          workerPid: 0,
          x: b.x ?? 0,
          y: b.y ?? 0,
          z: b.z ?? 0,
          health: 0,
          food: 0,
          latencyMs: 0,
          world: b.world ?? '',
          isDead: false,
          deathCount: b.deathCount ?? 0,
          connectedAt: b.connectedAt ?? null,
          lastError: null,
          lastHeartbeat: 0,
        });
      }
    }
    this.workerStates.delete(pid);
  }

  /** Remove a specific stopped bot (e.g., when user deletes it) */
  removeStopped(name: string): void {
    this.stoppedBots.delete(name);
  }

  /** Clear all stopped bot entries */
  clearStopped(): void {
    this.stoppedBots.clear();
  }
}
