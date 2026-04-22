import type { BotRegistry } from '../registry/bot-registry.js';
import { BotState } from '@jian-agent/shared-domain';
import type { StateReportPayload } from '@jian-agent/shared-protocol';

export class StateReporter {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly registry: BotRegistry,
    private readonly send: (payload: StateReportPayload) => void,
    private readonly intervalMs: number,
  ) {}

  start(): void {
    this.timer = setInterval(() => {
      this.sendSnapshot();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  sendSnapshot(): void {
    const bots = this.registry.all().map((info) => {
      const entity = info.bot?.entity;
      const pos = entity?.position;
      return {
        name: info.name,
        state: info.state,
        currentBehavior: info.currentBehavior?.name ?? null,
        connectedAt: info.connectedAt,
        lastError: info.lastError,
        x: pos?.x ?? 0,
        y: pos?.y ?? 0,
        z: pos?.z ?? 0,
        health: (info.bot as any)?.health ?? 0,
        food: (info.bot as any)?.food ?? 0,
        latencyMs: (info.bot as any)?.player?.ping ?? 0,
        world: (info.bot as any)?.game?.dimension ?? '',
        isDead: info.state === BotState.DEAD,
        deathCount: info.deathCount,
        lastHeartbeat: Date.now(),
      };
    });
    this.send({ bots: bots as any });
  }
}
