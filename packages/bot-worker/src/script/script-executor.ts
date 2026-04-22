import type { BotScript, BotScriptStep } from '@jian-agent/shared-protocol';

type ProgressFn = (
  stepIndex: number,
  totalSteps: number,
  loopIteration: number,
  completed: boolean,
) => void;

/** Resolve a param value that may be a random range string like "3~8" */
export function resolveNumericParam(value: unknown, fallback: number): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const rangeMatch = value.match(/^(-?\d+(?:\.\d+)?)\s*~\s*(-?\d+(?:\.\d+)?)$/);
    if (rangeMatch) {
      const min = Number(rangeMatch[1]);
      const max = Number(rangeMatch[2]);
      if (Number.isFinite(min) && Number.isFinite(max)) {
        return min + Math.random() * (max - min);
      }
    }
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return fallback;
}

export class ScriptExecutor {
  private running = false;
  private abortController: AbortController | null = null;

  constructor(
    private readonly bot: any, // mineflayer Bot
    private readonly onProgress: ProgressFn,
  ) {}

  async execute(script: BotScript): Promise<void> {
    this.running = true;
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const maxLoops = script.loop ? (script.loopCount ?? Infinity) : 1;
    let iteration = 0;

    try {
      while (this.running && iteration < maxLoops) {
        for (let i = 0; i < script.steps.length; i++) {
          if (!this.running || signal.aborted) return;
          this.onProgress(i, script.steps.length, iteration, false);
          await this.executeStep(script.steps[i], signal);
        }
        iteration++;
      }
      this.onProgress(script.steps.length, script.steps.length, iteration, true);
    } catch (err) {
      if (!signal.aborted) {
        console.error('[ScriptExecutor] unexpected error:', err);
      }
    }
  }

  stop(): void {
    this.running = false;
    this.abortController?.abort();
    this.abortController = null;
  }

  private async executeStep(step: BotScriptStep, signal: AbortSignal): Promise<void> {
    const p = step.params;
    switch (step.action) {
      case 'walk':    return this.doWalk(p, signal);
      case 'chat':    return this.doChat(p);
      case 'wait':    return this.doWait(p, signal);
      case 'turn':    return this.doTurn(p);
      case 'jump':    return this.doJump(signal);
      case 'attack':  return this.doAttack();
      case 'look':    return this.doLook(p);
      case 'move_to': return this.doMoveTo(p, signal);
      case 'use_item': return this.doUseItem();
    }
  }

  /* ---- action implementations ---- */

  private async doWalk(p: Readonly<Record<string, unknown>>, signal: AbortSignal): Promise<void> {
    const blocks = resolveNumericParam(p.blocks, 5);
    const durationMs = blocks * 250;
    const direction = String(p.direction ?? 'forward');

    if (direction === 'random') {
      const yaw = Math.random() * Math.PI * 2;
      try { this.bot.look(yaw, 0); } catch { /* ignore */ }
    }
    try { this.bot.setControlState('forward', true); } catch { /* ignore */ }
    await this.sleep(durationMs, signal);
    try { this.bot.setControlState('forward', false); } catch { /* ignore */ }
  }

  private async doChat(p: Readonly<Record<string, unknown>>): Promise<void> {
    const message = String(p.message ?? '');
    try { this.bot.chat(message); } catch { /* ignore */ }
  }

  private async doWait(p: Readonly<Record<string, unknown>>, signal: AbortSignal): Promise<void> {
    const seconds = resolveNumericParam(p.seconds, 1);
    await this.sleep(seconds * 1000, signal);
  }

  private async doTurn(p: Readonly<Record<string, unknown>>): Promise<void> {
    const degrees = resolveNumericParam(p.degrees, 90);
    const direction = String(p.direction ?? 'right');
    const delta = (direction === 'left' ? -1 : 1) * (degrees * Math.PI) / 180;
    try {
      const currentYaw: number = this.bot.entity?.yaw ?? 0;
      this.bot.look(currentYaw + delta, 0);
    } catch { /* ignore */ }
  }

  private async doJump(signal: AbortSignal): Promise<void> {
    try { this.bot.setControlState('jump', true); } catch { /* ignore */ }
    await this.sleep(300, signal);
    try { this.bot.setControlState('jump', false); } catch { /* ignore */ }
  }

  private async doAttack(): Promise<void> {
    try {
      const entity = this.bot.nearestEntity?.();
      if (entity) this.bot.attack(entity);
    } catch { /* ignore */ }
  }

  private async doLook(p: Readonly<Record<string, unknown>>): Promise<void> {
    const target = String(p.target ?? 'nearest_entity');
    try {
      const entity = target === 'nearest_player'
        ? this.findNearestPlayer()
        : this.bot.nearestEntity?.();
      if (entity?.position) {
        await this.bot.lookAt(entity.position.offset(0, entity.height ?? 1, 0));
      }
    } catch { /* ignore */ }
  }

  private async doMoveTo(p: Readonly<Record<string, unknown>>, signal: AbortSignal): Promise<void> {
    const target = String(p.target ?? 'nearest_player');
    const distance = resolveNumericParam(p.distance, 3);
    try {
      const entity = target === 'nearest_player'
        ? this.findNearestPlayer()
        : this.bot.nearestEntity?.();
      if (!entity?.position) return;

      const pos = this.bot.entity?.position;
      if (!pos) return;
      const dx = entity.position.x - pos.x;
      const dz = entity.position.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= distance) return;

      const yaw = Math.atan2(-dx, -dz);
      this.bot.look(yaw, 0);
      this.bot.setControlState('forward', true);
      await this.sleep(Math.min((dist - distance) * 250, 5000), signal);
      this.bot.setControlState('forward', false);
    } catch { /* ignore */ }
  }

  private async doUseItem(): Promise<void> {
    try { this.bot.activateItem(); } catch { /* ignore */ }
  }

  /* ---- helpers ---- */

  private findNearestPlayer(): any {
    const entities: Record<string, any> = this.bot.entities ?? {};
    let nearest: any = null;
    let minDist = Infinity;
    const pos = this.bot.entity?.position;
    if (!pos) return null;
    for (const e of Object.values(entities)) {
      if (e.type !== 'player' || e === this.bot.entity) continue;
      if (!e.position) continue;
      const d = pos.distanceTo(e.position);
      if (d < minDist) { minDist = d; nearest = e; }
    }
    return nearest;
  }

  private sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve) => {
      if (signal.aborted) { resolve(); return; }
      const timer = setTimeout(resolve, ms);
      const onAbort = () => { clearTimeout(timer); resolve(); };
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}
