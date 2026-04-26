/**
 * PVP arena setup and observation logic for local validation scenarios.
 *
 * Extracted from LocalValidationScenarioService — handles arena
 * construction, bot teleportation, forced damage, and death/respawn
 * observation during the pvp-damage-death-respawn stage.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { LocalValidationRunDto } from '@jian-agent/shared-domain';
import { BotOrchestratorService } from '../bot/bot-orchestrator.service.js';
import { BotStateService, type BotSnapshot } from '../bot/bot-state.service.js';
import { BotRealtimeService } from '../bot/bot-realtime.service.js';
import { ProcessManagerService } from '../server-process/process-manager.service.js';
import {
  SPAWNED_STATES,
  SCENARIO_POLL_INTERVAL_MS,
  PVP_STAGE_RESPAWN_GRACE_MS,
  SMOKE_PVP_FORCE_DAMAGE_DELAY_MS,
  PVP_ARENA_PLATFORM_Y,
  PVP_ARENA_CLEARANCE_Y,
  PVP_ARENA_HALF_WIDTH,
  PVP_ARENA_PAIR_SPACING,
  PVP_ARENA_OFFSET_X,
  PVP_ARENA_MIN_Z_HALF_SPAN,
  PVP_ARENA_SETTLE_DELAY_MS,
  PVP_FORCED_DAMAGE_AMOUNT,
  PVP_RECENT_EVENT_LIMIT,
} from './scenario-constants.js';

interface ValidationBatchContext {
  readonly batchId: string;
  readonly botNames: readonly string[];
}

export interface PvpStageObservation {
  readonly respawnedBots: ReadonlySet<string>;
  readonly diedBots: ReadonlySet<string>;
  readonly deathCountDeltaBots: ReadonlySet<string>;
  readonly readyBots: ReadonlySet<string>;
}

export interface PvpStagePreparation {
  readonly forcedRespawns: readonly string[];
  readonly smokeArenaApplied: boolean;
}

export interface PvpForcedDamageResult {
  readonly waitedMs: number;
  readonly damagedBots: readonly string[];
}

@Injectable()
export class PvpArenaService {
  private readonly logger = new Logger(PvpArenaService.name);

  constructor(
    private readonly botOrchestrator: BotOrchestratorService,
    private readonly botState: BotStateService,
    private readonly botRealtime: BotRealtimeService,
    private readonly processManager: ProcessManagerService,
  ) {}

  async preparePvpStage(
    run: LocalValidationRunDto,
    batch: ValidationBatchContext,
    attackers: readonly string[],
    defenders: readonly string[],
  ): Promise<PvpStagePreparation> {
    for (const botName of batch.botNames) {
      this.botOrchestrator.setBehavior(botName, 'idle', {});
    }

    const forcedRespawns = await this.forceRespawnUnavailableBots(batch.botNames);
    const smokeArenaApplied = await this.prepareSmokePvpArena(run.serverId, attackers, defenders);

    return {
      forcedRespawns,
      smokeArenaApplied,
    };
  }

  async forceRespawnUnavailableBots(botNames: readonly string[]): Promise<readonly string[]> {
    const unavailableBots = botNames.filter((botName) => {
      const snapshot = this.getSnapshot(botName);
      if (!snapshot) {
        return true;
      }

      return !SPAWNED_STATES.has(snapshot.state) || snapshot.isDead || snapshot.health <= 0;
    });

    if (!unavailableBots.length) {
      return [];
    }

    for (const botName of unavailableBots) {
      this.botOrchestrator.forceRespawn(botName);
    }

    await this.waitForReadyBots(botNames, PVP_STAGE_RESPAWN_GRACE_MS);
    return unavailableBots;
  }

  async prepareSmokePvpArena(
    serverId: string | undefined,
    attackers: readonly string[],
    defenders: readonly string[],
  ): Promise<boolean> {
    if (process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'] !== 'smoke' || !serverId) {
      return false;
    }

    const pairCount = Math.max(1, Math.max(attackers.length, defenders.length));
    const zHalfSpan = Math.max(PVP_ARENA_MIN_Z_HALF_SPAN, pairCount * PVP_ARENA_PAIR_SPACING);
    const commands = [
      'gamerule doImmediateRespawn true',
      'gamerule keepInventory true',
      'difficulty easy',
      'time set day',
      'weather clear',
      `fill -${PVP_ARENA_HALF_WIDTH} ${PVP_ARENA_PLATFORM_Y} -${zHalfSpan} ${PVP_ARENA_HALF_WIDTH} ${PVP_ARENA_PLATFORM_Y} ${zHalfSpan} stone`,
      `fill -${PVP_ARENA_HALF_WIDTH} ${PVP_ARENA_PLATFORM_Y + 1} -${zHalfSpan} ${PVP_ARENA_HALF_WIDTH} ${PVP_ARENA_CLEARANCE_Y} ${zHalfSpan} air`,
    ];

    const allBots = [...attackers, ...defenders];
    for (const botName of allBots) {
      commands.push(`clear ${botName}`);
      commands.push(`gamemode survival ${botName}`);
      commands.push(`effect clear ${botName}`);
      commands.push(`give ${botName} minecraft:iron_sword 1`);
      commands.push(`effect give ${botName} minecraft:instant_health 1 4 true`);
      commands.push(`effect give ${botName} minecraft:saturation 1 4 true`);
    }

    for (let index = 0; index < pairCount; index += 1) {
      const z = (index - Math.floor(pairCount / 2)) * PVP_ARENA_PAIR_SPACING;
      const attacker = attackers[index];
      const defender = defenders[index];

      if (attacker) {
        commands.push(`tp ${attacker} -${PVP_ARENA_OFFSET_X} ${PVP_ARENA_PLATFORM_Y + 1} ${z}`);
      }
      if (defender) {
        commands.push(`tp ${defender} ${PVP_ARENA_OFFSET_X} ${PVP_ARENA_PLATFORM_Y + 1} ${z}`);
      }
    }

    this.executeServerCommands(serverId, commands);
    await this.sleep(PVP_ARENA_SETTLE_DELAY_MS);
    return true;
  }

  executeServerCommands(serverId: string, commands: readonly string[]): void {
    for (const command of commands) {
      this.processManager.writeStdin(serverId, `${command}\n`);
    }
  }

  async observePvpStageOutcome(
    run: LocalValidationRunDto,
    batch: ValidationBatchContext,
    beforeDeaths: ReadonlyMap<string, number>,
    stageStart: number,
  ): Promise<PvpStageObservation> {
    const deadline = Date.now() + this.resolvePvpStageRespawnGraceMs();
    let observation = this.collectPvpStageObservation(run, batch, beforeDeaths, stageStart);

    while (Date.now() < deadline) {
      const hasNewDeaths = observation.diedBots.size > 0 || observation.deathCountDeltaBots.size > 0;
      const waitingForRespawns = observation.respawnedBots.size < observation.deathCountDeltaBots.size;
      if (!hasNewDeaths || !waitingForRespawns) {
        return observation;
      }

      await this.sleep(SCENARIO_POLL_INTERVAL_MS);
      observation = this.collectPvpStageObservation(run, batch, beforeDeaths, stageStart);
    }

    return observation;
  }

  async forceSmokePvpDamageIfNeeded(
    run: LocalValidationRunDto,
    batch: ValidationBatchContext,
    attackers: readonly string[],
    defenders: readonly string[],
    beforeDeaths: ReadonlyMap<string, number>,
    stageStart: number,
    durationMs: number,
  ): Promise<PvpForcedDamageResult> {
    if (process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'] !== 'smoke' || !run.serverId) {
      return { waitedMs: 0, damagedBots: [] };
    }

    const warmupMs = Math.min(durationMs, SMOKE_PVP_FORCE_DAMAGE_DELAY_MS);
    if (warmupMs > 0) {
      await this.sleep(warmupMs);
    }

    const observation = this.collectPvpStageObservation(run, batch, beforeDeaths, stageStart);
    const hasDeaths = observation.diedBots.size > 0 || observation.deathCountDeltaBots.size > 0;
    if (hasDeaths) {
      return { waitedMs: warmupMs, damagedBots: [] };
    }

    const commands: string[] = [];
    const damagedBots: string[] = [];
    const pairCount = Math.min(attackers.length, defenders.length);
    for (let index = 0; index < pairCount; index += 1) {
      const attacker = attackers[index];
      const defender = defenders[index];
      if (!attacker || !defender) {
        continue;
      }
      commands.push(`damage ${defender} ${PVP_FORCED_DAMAGE_AMOUNT} minecraft:player_attack by ${attacker}`);
      damagedBots.push(defender);
    }

    if (!commands.length) {
      return { waitedMs: warmupMs, damagedBots: [] };
    }

    this.executeServerCommands(run.serverId, commands);
    await this.sleep(PVP_ARENA_SETTLE_DELAY_MS);
    return {
      waitedMs: warmupMs + PVP_ARENA_SETTLE_DELAY_MS,
      damagedBots,
    };
  }

  collectPvpStageObservation(
    run: LocalValidationRunDto,
    batch: ValidationBatchContext,
    beforeDeaths: ReadonlyMap<string, number>,
    stageStart: number,
  ): PvpStageObservation {
    const recentEvents = this.botRealtime.getRecentBotEvents({
      validationRunId: run.id,
      batchId: batch.batchId,
      limit: PVP_RECENT_EVENT_LIMIT,
    }).filter((event) => event.timestamp >= stageStart);
    const diedBots = new Set(
      recentEvents
        .filter((event) => event.event === 'DIED')
        .map((event) => event.botName),
    );
    const respawnedBots = new Set(
      recentEvents
        .filter((event) => event.event === 'RESPAWNED')
        .map((event) => event.botName),
    );
    const afterDeaths = this.snapshotDeathCounts(batch.botNames);
    const readyBots = new Set<string>();
    const deathCountDeltaBots = new Set<string>();

    for (const botName of batch.botNames) {
      const snapshot = this.getSnapshot(botName);
      const hasReadyState = !!snapshot && SPAWNED_STATES.has(snapshot.state) && !snapshot.isDead && snapshot.health > 0;
      if (hasReadyState) {
        readyBots.add(botName);
      }

      if ((afterDeaths.get(botName) ?? 0) > (beforeDeaths.get(botName) ?? 0)) {
        deathCountDeltaBots.add(botName);
        if (hasReadyState) {
          respawnedBots.add(botName);
        }
      }
    }

    return {
      respawnedBots,
      diedBots,
      deathCountDeltaBots,
      readyBots,
    };
  }

  snapshotDeathCounts(botNames: readonly string[]): Map<string, number> {
    const snapshots = this.botState.allBots();
    const result = new Map<string, number>();
    for (const botName of botNames) {
      const snapshot = snapshots.find((bot) => bot.name === botName);
      result.set(botName, snapshot?.deathCount ?? 0);
    }
    return result;
  }

  private resolvePvpStageRespawnGraceMs(): number {
    return process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'] === 'smoke' ? PVP_STAGE_RESPAWN_GRACE_MS : 0;
  }

  private getSnapshot(botName: string): BotSnapshot | undefined {
    return this.botState.allBots().find((bot) => bot.name === botName);
  }

  private async waitForReadyBots(botNames: readonly string[], timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    do {
      const readyBots = botNames.filter((botName) => {
        const snapshot = this.getSnapshot(botName);
        return !!snapshot && SPAWNED_STATES.has(snapshot.state) && !snapshot.isDead && snapshot.health > 0;
      });
      if (readyBots.length >= botNames.length || timeoutMs <= 0) {
        return;
      }

      await this.sleep(SCENARIO_POLL_INTERVAL_MS);
    } while (Date.now() < deadline);
  }

  private sleep(ms: number): Promise<void> {
    if (ms <= 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
