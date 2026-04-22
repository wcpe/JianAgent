import { Inject, Injectable, Logger } from '@nestjs/common';
import type { LocalValidationRunDto, LocalValidationStageDto } from '@jian-agent/shared-domain';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BotOrchestratorService } from '../bot/bot-orchestrator.service.js';
import { BotRealtimeService } from '../bot/bot-realtime.service.js';
import { BotStateService, type BotSnapshot } from '../bot/bot-state.service.js';
import { ProcessManagerService } from '../server-process/process-manager.service.js';
import { LocalValidationStore } from './local-validation.store.js';
import type { ScenarioPackDefinition, ScenarioStageDefinition } from './scenario-catalog.service.js';
import { ScenarioCatalogService } from './scenario-catalog.service.js';
import { ScenarioAssertionService } from './scenario-assertion.service.js';
import { ValidationEvidenceService } from './validation-evidence.service.js';
import { ValidationReportService } from './validation-report.service.js';

interface ValidationBatchContext {
  readonly batchId: string;
  readonly botNames: readonly string[];
}

interface ValidationStageOutcome {
  readonly stage: LocalValidationStageDto;
  readonly assertions: readonly {
    readonly key: string;
    readonly status: 'passed' | 'failed' | 'pending' | 'skipped';
    readonly title: string;
    readonly threshold: number;
    readonly actual: number;
    readonly message: string;
    readonly evidenceRefs?: readonly string[];
  }[];
  readonly status: 'passed' | 'failed' | 'pending' | 'skipped';
}

interface TerrainBlockSnapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly name: string;
}

const SPAWNED_STATES = new Set(['SPAWNED', 'online']);
const SCENARIO_POLL_INTERVAL_MS = 250;
const PVP_STAGE_RESPAWN_GRACE_MS = 5_000;
const SMOKE_PVP_FORCE_DAMAGE_DELAY_MS = 10_000;
const PVP_ARENA_PLATFORM_Y = 80;
const PVP_ARENA_CLEARANCE_Y = 85;
const PVP_ARENA_HALF_WIDTH = 6;
const PVP_ARENA_PAIR_SPACING = 6;
const PVP_ARENA_OFFSET_X = 2;

interface PvpStageObservation {
  readonly respawnedBots: ReadonlySet<string>;
  readonly diedBots: ReadonlySet<string>;
  readonly deathCountDeltaBots: ReadonlySet<string>;
  readonly readyBots: ReadonlySet<string>;
}

interface PvpStagePreparation {
  readonly forcedRespawns: readonly string[];
  readonly smokeArenaApplied: boolean;
}

@Injectable()
export class LocalValidationScenarioService {
  private readonly logger = new Logger(LocalValidationScenarioService.name);

  constructor(
    private readonly store: LocalValidationStore,
    private readonly scenarioCatalog: ScenarioCatalogService,
    private readonly scenarioAssertions: ScenarioAssertionService,
    private readonly botOrchestrator: BotOrchestratorService,
    private readonly botState: BotStateService,
    private readonly botRealtime: BotRealtimeService,
    private readonly processManager: ProcessManagerService,
    private readonly validationEvidence: ValidationEvidenceService,
    private readonly validationReport: ValidationReportService,
    @Inject(EventEmitter2) private readonly eventBus: EventEmitter2,
  ) {}

  async executeScenario(run: LocalValidationRunDto): Promise<LocalValidationRunDto> {
    if (!run.serverId) {
      throw new Error(`Local validation run ${run.id} has no attached server`);
    }

    const pack = this.scenarioCatalog.getScenarioPackDefinition(run.scenarioPackId);
    const batch = await this.createValidationBatch(run);
    const persistedAssertions: Array<{ key: string; status: string }> = [];

    let currentRun = await this.updateRunStatusAndEmit(run.id, 'RUNNING_SCENARIO', {
      effectiveBotCount: batch.botNames.length,
    });

    try {
      for (const stage of pack.stages) {
        const outcome = await this.executeStage(currentRun, pack, batch, stage);
        persistedAssertions.push(...outcome.assertions.map((assertion) => ({
          key: assertion.key,
          status: assertion.status,
        })));

        if (outcome.status === 'failed') {
          currentRun = await this.updateRunStatusAndEmit(run.id, 'FAILED_SCENARIO', {
            effectiveBotCount: batch.botNames.length,
            failureCode: `stage_${stage.key}_failed`,
            failureMessage: outcome.assertions[0]?.message ?? `${stage.title} failed`,
          });
          await this.appendScenarioReport(currentRun, persistedAssertions);
          return currentRun;
        }
      }

      currentRun = await this.updateRunStatusAndEmit(run.id, 'PASSED', {
        effectiveBotCount: batch.botNames.length,
        failureCode: null,
        failureMessage: null,
      });
      await this.appendScenarioReport(currentRun, persistedAssertions);
      return currentRun;
    } catch (error) {
      currentRun = await this.updateRunStatusAndEmit(run.id, 'FAILED_RUNTIME', {
        effectiveBotCount: batch.botNames.length,
        failureCode: 'scenario_execution_failed',
        failureMessage: error instanceof Error ? error.message : String(error),
      });
      await this.validationEvidence.appendFailureEvidence(run.id, '场景执行失败', {
        status: 'FAILED_RUNTIME',
        serverId: run.serverId,
        failureCode: 'scenario_execution_failed',
        failureMessage: error instanceof Error ? error.message : String(error),
      });
      await this.appendScenarioReport(currentRun, persistedAssertions);
      return currentRun;
    } finally {
      this.botOrchestrator.stopBatch(batch.batchId);
    }
  }

  private async createValidationBatch(run: LocalValidationRunDto): Promise<ValidationBatchContext> {
    const batch = await this.botOrchestrator.createBotBatch({
      serverId: run.serverId!,
      namePrefix: `${run.id}-bot`,
      count: run.requestedBotCount,
      behavior: 'idle',
      autoRespawn: true,
      validationRunId: run.id,
    });

    await this.validationEvidence.appendOperationEvidence(run.id, '机器人批次已创建', {
      batchId: batch.batchId,
      botNames: batch.createdNames,
      requestedBotCount: run.requestedBotCount,
      effectiveBotCount: batch.createdNames.length,
    });

    return {
      batchId: batch.batchId,
      botNames: batch.createdNames,
    };
  }

  private async executeStage(
    run: LocalValidationRunDto,
    pack: ScenarioPackDefinition,
    batch: ValidationBatchContext,
    stage: ScenarioStageDefinition,
  ): Promise<ValidationStageOutcome> {
    const startedAt = new Date().toISOString();
    const groups = this.buildStageGroups(stage, batch.botNames);
    const stageRow = await this.store.upsertStage({
      runId: run.id,
      stageKey: stage.key,
      title: stage.title,
      status: 'running',
      startedAt,
      timeoutMs: stage.durationSec * 1000,
      botGroupSnapshot: groups,
    });
    this.emitStage(stageRow);

    const outcome = await this.evaluateStage(run, batch, stage, groups);
    const persistedAssertions = await this.store.replaceAssertions(
      run.id,
      outcome.assertions.map((assertion) => ({
        stageId: stageRow.id,
        key: assertion.key,
        title: assertion.title,
        required: true,
        status: assertion.status,
        threshold: assertion.threshold,
        actual: assertion.actual,
        message: assertion.message,
        evidenceRefs: assertion.evidenceRefs ?? [],
      })),
    );
    this.emitAssertions(run.id, stageRow.id, persistedAssertions);

    const finishedStage = await this.store.upsertStage({
      id: stageRow.id,
      runId: run.id,
      stageKey: stage.key,
      title: stage.title,
      status: outcome.status,
      startedAt,
      finishedAt: new Date().toISOString(),
      timeoutMs: stage.durationSec * 1000,
      botGroupSnapshot: groups,
      assertionSummary: {
        total: persistedAssertions.length,
        passed: persistedAssertions.filter((item) => item.status === 'passed').length,
        failed: persistedAssertions.filter((item) => item.status === 'failed').length,
      },
    });
    this.emitStage(finishedStage);

    await this.validationEvidence.appendOperationEvidence(run.id, `${stage.title} 完成`, {
      stageKey: stage.key,
      status: outcome.status,
      batchId: batch.batchId,
      assertions: persistedAssertions.map((item) => ({
        key: item.key,
        status: item.status,
        threshold: item.threshold,
        actual: item.actual,
      })),
    });

    return {
      stage: finishedStage,
      assertions: persistedAssertions,
      status: outcome.status,
    };
  }

  private async evaluateStage(
    run: LocalValidationRunDto,
    batch: ValidationBatchContext,
    stage: ScenarioStageDefinition,
    groups: LocalValidationStageDto['botGroupSnapshot'],
  ): Promise<Omit<ValidationStageOutcome, 'stage'>> {
    switch (stage.key) {
      case 'spawn-and-stabilize':
        return this.executeSpawnStage(run, batch, stage);
      case 'movement-and-chat':
        return this.executeMovementAndChatStage(run, batch, stage, groups);
      case 'gather-and-place':
        return this.executeGatherAndPlaceStage(run, batch, stage);
      case 'pvp-damage-death-respawn':
        return this.executePvpStage(run, batch, stage, groups);
      default:
        throw new Error(`Unsupported local validation stage: ${stage.key}`);
    }
  }

  private async executeSpawnStage(
    run: LocalValidationRunDto,
    batch: ValidationBatchContext,
    stage: ScenarioStageDefinition,
  ): Promise<Omit<ValidationStageOutcome, 'stage'>> {
    const spawnedBots = await this.waitForSpawnedBots(batch.botNames, stage.durationSec * 1000);
    const evaluation = this.scenarioAssertions.evaluateStage('spawn-and-stabilize', {
      threshold: stage.threshold,
      spawnedBots: batch.botNames.length,
      stabilizedBots: spawnedBots,
    });

    await this.validationEvidence.appendBotEventEvidence(run.id, '出生稳定性检查', {
      stageKey: stage.key,
      spawnedBots,
      requestedBots: batch.botNames.length,
    });

    return {
      assertions: evaluation.assertions,
      status: evaluation.status,
    };
  }

  private async executeMovementAndChatStage(
    run: LocalValidationRunDto,
    batch: ValidationBatchContext,
    stage: ScenarioStageDefinition,
    groups: LocalValidationStageDto['botGroupSnapshot'],
  ): Promise<Omit<ValidationStageOutcome, 'stage'>> {
    const movingGroup = groups[0]?.botNames ?? [];
    const chattingGroup = groups[1]?.botNames ?? [];
    const initialPositions = this.snapshotPositions(movingGroup);

    for (const botName of movingGroup) {
      const snapshot = this.getSnapshot(botName);
      const movementBehavior = this.buildMovementStageBehavior(stage, snapshot);
      this.botOrchestrator.setBehavior(botName, movementBehavior.behavior, movementBehavior.params);
    }
    for (const botName of chattingGroup) {
      this.botOrchestrator.setBehavior(botName, 'chat', {
        messages: ['validation: ready', 'validation: patrol', 'validation: chat'],
        intervalMs: this.resolveMovementStageChatIntervalMs(),
      });
    }

    const stageStart = Date.now();
    await this.sleep(stage.durationSec * 1000);

    const movedBots = movingGroup.filter((botName) => {
      const before = initialPositions.get(botName);
      const after = this.getSnapshot(botName);
      if (!before || !after) {
        return false;
      }
      return this.positionDistance(before, after) >= 1.5;
    }).length;

    const chatMessages = this.botRealtime.getRecentChatMessages({
      validationRunId: run.id,
      batchId: batch.batchId,
      sinceTimestamp: stageStart,
      limit: 500,
    });
    const chattingBots = new Set(
      chatMessages
        .filter((message) => chattingGroup.includes(message.botName))
        .map((message) => message.botName),
    ).size;

    const evaluation = this.scenarioAssertions.evaluateStage('movement-and-chat', {
      threshold: stage.threshold,
      spawnedBots: batch.botNames.length,
      movingBots: movedBots,
      movingGroupSize: movingGroup.length,
      chattingBots,
      chattingGroupSize: chattingGroup.length,
    });

    await this.validationEvidence.appendBotEventEvidence(run.id, '移动与聊天检查', {
      stageKey: stage.key,
      movedBots,
      chattingBots,
      batchId: batch.batchId,
    });

    return {
      assertions: evaluation.assertions,
      status: evaluation.status,
    };
  }

  private async executeGatherAndPlaceStage(
    run: LocalValidationRunDto,
    batch: ValidationBatchContext,
    stage: ScenarioStageDefinition,
  ): Promise<Omit<ValidationStageOutcome, 'stage'>> {
    const stageStart = Date.now();
    const preGatherDetails = await Promise.all(batch.botNames.map(async (botName) => ({
      botName,
      detail: await this.botOrchestrator.getBotDetail(botName),
    })));

    for (const botName of batch.botNames) {
      this.botOrchestrator.setBehavior(botName, 'gather', { blockTypes: ['grass_block', 'dirt'], radius: 8 });
    }

    const durationMs = stage.durationSec * 1000;
    const gatherDurationMs = durationMs > 0 ? Math.floor(durationMs / 2) : 0;
    await this.sleep(gatherDurationMs);

    const snapshots = this.snapshotPositions(batch.botNames);
    const gatheredDetails = await Promise.all(batch.botNames.map(async (botName) => ({
      botName,
      detail: await this.botOrchestrator.getBotDetail(botName),
    })));
    const gatheredBots = gatheredDetails
      .filter(({ detail }) => detail.inventory.some((item) => item.name === 'dirt' || item.name.endsWith('_log') || item.name.endsWith('_planks')))
      .map(({ botName }) => botName);

    const buildTargets = new Map<string, { x: number; y: number; z: number; blockName: string }>();
    for (const botName of batch.botNames) {
      const snapshot = snapshots.get(botName);
      if (!snapshot) {
        continue;
      }
      if (gatheredBots.includes(botName)) {
        const preGatherDetail = preGatherDetails.find((item) => item.botName === botName)?.detail;
        const gatheredDetail = gatheredDetails.find((item) => item.botName === botName)?.detail;
        const blockName = gatheredDetail?.inventory.find((item) => item.name === 'dirt' || item.name.endsWith('_log') || item.name.endsWith('_planks'))
          ?.name ?? 'dirt';
        const target = this.resolveBuildTarget(
          snapshot,
          preGatherDetail?.terrain ?? [],
          gatheredDetail?.terrain ?? [],
          blockName,
        );
        buildTargets.set(botName, target);
        this.botOrchestrator.setBehavior(botName, 'build', {
          actions: [{ type: 'place', ...target }],
        });
      } else {
        this.botOrchestrator.setBehavior(botName, 'idle', {});
      }
    }

    await this.sleep(Math.max(durationMs - gatherDurationMs, 0));

    const postBuildDetails = await Promise.all(gatheredBots.map(async (botName) => ({
      botName,
      detail: await this.botOrchestrator.getBotDetail(botName),
    })));
    const buildTelemetry = this.collectBuildTelemetry(run.id, batch.batchId, stageStart);
    let placedByTerrainBots = 0;
    let placedByEventBots = 0;
    let inventoryConsumedBots = 0;
    const placedBots = postBuildDetails.filter(({ botName, detail }) => {
      const target = buildTargets.get(botName);
      if (!target) {
        return false;
      }
      const targetMatched = detail.terrain.some((block) =>
        block.x === target.x
        && block.y === target.y
        && block.z === target.z
        && block.name === target.blockName,
      );
      if (targetMatched) {
        placedByTerrainBots += 1;
        return true;
      }

      if (buildTelemetry.successBots.has(botName)) {
        placedByEventBots += 1;
        return true;
      }

      const gatheredDetail = gatheredDetails.find((item) => item.botName === botName)?.detail;
      const beforeInventoryCount = this.countInventoryItems(gatheredDetail?.inventory ?? [], target.blockName);
      const afterInventoryCount = this.countInventoryItems(detail.inventory, target.blockName);
      if (beforeInventoryCount > afterInventoryCount) {
        inventoryConsumedBots += 1;
      }

      return false;
    }).length;

    const evaluation = this.scenarioAssertions.evaluateStage('gather-and-place', {
      threshold: stage.threshold,
      spawnedBots: batch.botNames.length,
      gatheredBots: gatheredBots.length,
      placedBots,
    });

    await this.validationEvidence.appendBotEventEvidence(run.id, '采集与放置检查', {
      stageKey: stage.key,
      gatheredBots: gatheredBots.length,
      placedBots,
      placedByTerrainBots,
      placedByEventBots,
      inventoryConsumedBots,
      buildAttempts: buildTelemetry.attempts,
      buildFailureReasonCounts: buildTelemetry.failureReasonCounts,
      buildFailureSamples: buildTelemetry.failureSamples,
      batchId: batch.batchId,
    });

    return {
      assertions: evaluation.assertions,
      status: evaluation.status,
    };
  }

  private async executePvpStage(
    run: LocalValidationRunDto,
    batch: ValidationBatchContext,
    stage: ScenarioStageDefinition,
    groups: LocalValidationStageDto['botGroupSnapshot'],
  ): Promise<Omit<ValidationStageOutcome, 'stage'>> {
    const attackers = groups[0]?.botNames ?? [];
    const defenders = groups[1]?.botNames ?? [];
    const preparation = await this.preparePvpStage(run, batch, attackers, defenders);
    const beforeDeaths = this.snapshotDeathCounts(batch.botNames);

    for (let index = 0; index < batch.botNames.length; index += 2) {
      const left = batch.botNames[index];
      const right = batch.botNames[index + 1];
      if (left && right) {
        this.botOrchestrator.setBehavior(left, 'attack', { target: right, chaseRange: 16, attackRange: 3.5 });
        this.botOrchestrator.setBehavior(right, 'attack', { target: left, chaseRange: 16, attackRange: 3.5 });
      } else if (left) {
        this.botOrchestrator.setBehavior(left, 'attack', { chaseRange: 16, attackRange: 3.5 });
      }
    }

    const stageStart = Date.now();
    const durationMs = stage.durationSec * 1000;
    const forcedSmokeDamage = await this.forceSmokePvpDamageIfNeeded(
      run,
      batch,
      attackers,
      defenders,
      beforeDeaths,
      stageStart,
      durationMs,
    );
    const remainingDurationMs = Math.max(durationMs - forcedSmokeDamage.waitedMs, 0);
    await this.sleep(remainingDurationMs);
    const observation = await this.observePvpStageOutcome(run, batch, beforeDeaths, stageStart);

    const evaluation = this.scenarioAssertions.evaluateStage('pvp-damage-death-respawn', {
      threshold: stage.threshold,
      spawnedBots: batch.botNames.length,
      respawnedBots: observation.respawnedBots.size,
    });

    await this.validationEvidence.appendBotEventEvidence(run.id, 'PvP 与重生检查', {
      stageKey: stage.key,
      attackers,
      defenders,
      respawnedBots: [...observation.respawnedBots],
      diedBots: [...observation.diedBots],
      deathCountDeltaBots: [...observation.deathCountDeltaBots],
      readyBots: [...observation.readyBots],
      forcedRespawns: preparation.forcedRespawns,
      smokeArenaApplied: preparation.smokeArenaApplied,
      smokeForcedDamageBots: forcedSmokeDamage.damagedBots,
      batchId: batch.batchId,
    });

    return {
      assertions: evaluation.assertions,
      status: evaluation.status,
    };
  }

  private buildStageGroups(
    stage: ScenarioStageDefinition,
    botNames: readonly string[],
  ): LocalValidationStageDto['botGroupSnapshot'] {
    if (stage.key === 'movement-and-chat') {
      return [
        { name: 'patrol-group', botNames: botNames.filter((_, index) => index % 2 === 0) },
        { name: 'chat-group', botNames: botNames.filter((_, index) => index % 2 === 1) },
      ];
    }

    if (stage.key === 'pvp-damage-death-respawn') {
      return [
        { name: 'attackers', botNames: botNames.filter((_, index) => index % 2 === 0) },
        { name: 'defenders', botNames: botNames.filter((_, index) => index % 2 === 1) },
      ];
    }

    return [{ name: 'validation-bots', botNames: [...botNames] }];
  }

  private getSnapshot(botName: string): BotSnapshot | undefined {
    return this.botState.allBots().find((bot) => bot.name === botName);
  }

  private snapshotPositions(botNames: readonly string[]): Map<string, Pick<BotSnapshot, 'x' | 'y' | 'z'>> {
    const snapshots = this.botState.allBots();
    const result = new Map<string, Pick<BotSnapshot, 'x' | 'y' | 'z'>>();
    for (const botName of botNames) {
      const snapshot = snapshots.find((bot) => bot.name === botName);
      if (snapshot) {
        result.set(botName, snapshot);
      }
    }
    return result;
  }

  private snapshotDeathCounts(botNames: readonly string[]): Map<string, number> {
    const snapshots = this.botState.allBots();
    const result = new Map<string, number>();
    for (const botName of botNames) {
      const snapshot = snapshots.find((bot) => bot.name === botName);
      result.set(botName, snapshot?.deathCount ?? 0);
    }
    return result;
  }

  private buildPatrolWaypoints(snapshot: Pick<BotSnapshot, 'x' | 'y' | 'z'>): readonly { x: number; y: number; z: number; waitMs?: number }[] {
    const x = Math.floor(snapshot.x);
    const y = Math.floor(snapshot.y);
    const z = Math.floor(snapshot.z);
    return [
      { x: x + 2, y, z, waitMs: 200 },
      { x, y, z: z + 2, waitMs: 200 },
      { x: x - 2, y, z, waitMs: 200 },
      { x, y, z: z - 2, waitMs: 200 },
    ];
  }

  private resolveBuildTarget(
    snapshot: Pick<BotSnapshot, 'x' | 'y' | 'z'>,
    preGatherTerrain: readonly TerrainBlockSnapshot[],
    terrain: readonly TerrainBlockSnapshot[],
    blockName: string,
  ): { x: number; y: number; z: number; blockName: string } {
    const excavatedTarget = this.resolveExcavatedColumnTarget(snapshot, preGatherTerrain, terrain, blockName);
    if (excavatedTarget) {
      return excavatedTarget;
    }

    const originX = Math.floor(snapshot.x);
    const originY = Math.floor(snapshot.y);
    const originZ = Math.floor(snapshot.z);
    const nearbySurface = terrain
      .filter((block) => this.isBuildableSurface(block.name))
      .filter((block) => !(block.x === originX && block.z === originZ))
      .map((block) => ({
        block,
        distance: Math.sqrt(
          ((block.x + 0.5) - snapshot.x) ** 2
          + ((block.z + 0.5) - snapshot.z) ** 2,
        ),
      }))
      .filter((entry) => entry.distance <= 3.5)
      .sort((left, right) => left.distance - right.distance)[0]?.block;

    if (nearbySurface) {
      return {
        x: nearbySurface.x,
        y: nearbySurface.y + 1,
        z: nearbySurface.z,
        blockName,
      };
    }

    return {
      x: originX + 1,
      y: originY,
      z: originZ,
      blockName,
    };
  }

  private resolveExcavatedColumnTarget(
    snapshot: Pick<BotSnapshot, 'x' | 'y' | 'z'>,
    preGatherTerrain: readonly TerrainBlockSnapshot[],
    terrain: readonly TerrainBlockSnapshot[],
    blockName: string,
  ): { x: number; y: number; z: number; blockName: string } | null {
    if (!preGatherTerrain.length || !terrain.length) {
      return null;
    }

    const terrainByColumn = new Map(
      terrain.map((block) => [`${block.x}:${block.z}`, block] as const),
    );

    const closestExcavatedColumn = preGatherTerrain
      .filter((block) => this.isBuildableSurface(block.name))
      .map((before) => {
        const after = terrainByColumn.get(`${before.x}:${before.z}`);
        const depthDelta = after ? before.y - after.y : 1;
        const distance = Math.sqrt(
          ((before.x + 0.5) - snapshot.x) ** 2
          + ((before.z + 0.5) - snapshot.z) ** 2,
        );
        return {
          before,
          depthDelta,
          distance,
        };
      })
      .filter((entry) => entry.depthDelta > 0 && entry.depthDelta <= 2)
      .filter((entry) => entry.distance <= 4.5)
      .sort((left, right) => left.distance - right.distance)[0]?.before;

    if (!closestExcavatedColumn) {
      return null;
    }

    return {
      x: closestExcavatedColumn.x,
      y: closestExcavatedColumn.y,
      z: closestExcavatedColumn.z,
      blockName,
    };
  }

  private isBuildableSurface(blockName: string): boolean {
    if (blockName.endsWith('_leaves')) {
      return false;
    }

    return !new Set([
      'grass',
      'tall_grass',
      'short_grass',
      'fern',
      'large_fern',
      'vine',
      'cave_vines',
      'cave_vines_plant',
      'weeping_vines',
      'weeping_vines_plant',
      'twisting_vines',
      'twisting_vines_plant',
      'dead_bush',
      'dandelion',
      'poppy',
      'blue_orchid',
      'allium',
      'azure_bluet',
      'red_tulip',
      'orange_tulip',
      'white_tulip',
      'pink_tulip',
      'oxeye_daisy',
      'cornflower',
      'lily_of_the_valley',
      'torchflower',
    ]).has(blockName);
  }

  private countInventoryItems(
    inventory: readonly { name: string; count?: number }[],
    blockName: string,
  ): number {
    return inventory
      .filter((item) => item.name === blockName)
      .reduce((total, item) => total + (item.count ?? 0), 0);
  }

  private collectBuildTelemetry(
    runId: string,
    batchId: string,
    sinceTimestamp: number,
  ): {
    readonly attempts: number;
    readonly successBots: ReadonlySet<string>;
    readonly failureReasonCounts: Record<string, number>;
    readonly failureSamples: readonly Record<string, unknown>[];
  } {
    const events = this.botRealtime.getRecentBotEvents({
      validationRunId: runId,
      batchId,
      sinceTimestamp,
      limit: 500,
    });

    const successBots = new Set<string>();
    const failureReasonCounts: Record<string, number> = {};
    const failureSamples: Array<Record<string, unknown>> = [];
    let attempts = 0;

    for (const event of events) {
      if (event.event === 'BUILD_ATTEMPT') {
        attempts += 1;
        continue;
      }
      if (event.event === 'BUILD_SUCCESS') {
        successBots.add(event.botName);
        continue;
      }
      if (event.event !== 'BUILD_FAILURE') {
        continue;
      }

      const reason = typeof event.metadata?.['reason'] === 'string'
        ? event.metadata['reason']
        : 'unknown';
      failureReasonCounts[reason] = (failureReasonCounts[reason] ?? 0) + 1;
      if (failureSamples.length < 10) {
        failureSamples.push({
          botName: event.botName,
          reason,
          message: event.message,
          metadata: event.metadata ?? {},
        });
      }
    }

    return {
      attempts,
      successBots,
      failureReasonCounts,
      failureSamples,
    };
  }

  private buildMovementStageBehavior(
    stage: ScenarioStageDefinition,
    snapshot: Pick<BotSnapshot, 'x' | 'y' | 'z'> | undefined,
  ): { readonly behavior: string; readonly params: Record<string, unknown> } {
    const scenarioProfile = process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'] === 'smoke' ? 'smoke' : 'default';
    const navigationProfile =
      scenarioProfile === 'smoke' ? 'pathfinder-strict' : 'pathfinder-balanced';
    const determinismLevel = scenarioProfile === 'smoke' ? 'strict' : 'balanced';

    if (stage.behaviorTemplate === 'move-random') {
      return {
        behavior: 'move-random',
        params: {
          navigationProfile,
          scenarioProfile,
          determinismLevel,
        },
      };
    }

    const waypoints = snapshot ? this.buildPatrolWaypoints(snapshot) : [];
    return {
      behavior: 'patrol',
      params: {
        waypoints,
        loop: true,
        navigationProfile,
        scenarioProfile,
        determinismLevel,
      },
    };
  }

  private resolveMovementStageChatIntervalMs(): number {
    return process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'] === 'smoke' ? 2500 : 500;
  }

  private async preparePvpStage(
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

  private async forceRespawnUnavailableBots(botNames: readonly string[]): Promise<readonly string[]> {
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

  private async prepareSmokePvpArena(
    serverId: string | undefined,
    attackers: readonly string[],
    defenders: readonly string[],
  ): Promise<boolean> {
    if (process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'] !== 'smoke' || !serverId) {
      return false;
    }

    const pairCount = Math.max(1, Math.max(attackers.length, defenders.length));
    const zHalfSpan = Math.max(4, pairCount * PVP_ARENA_PAIR_SPACING);
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
    await this.sleep(1_500);
    return true;
  }

  private executeServerCommands(serverId: string, commands: readonly string[]): void {
    for (const command of commands) {
      this.processManager.writeStdin(serverId, `${command}\n`);
    }
  }

  private async observePvpStageOutcome(
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

  private async forceSmokePvpDamageIfNeeded(
    run: LocalValidationRunDto,
    batch: ValidationBatchContext,
    attackers: readonly string[],
    defenders: readonly string[],
    beforeDeaths: ReadonlyMap<string, number>,
    stageStart: number,
    durationMs: number,
  ): Promise<{ readonly waitedMs: number; readonly damagedBots: readonly string[] }> {
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
      commands.push(`damage ${defender} 40 minecraft:player_attack by ${attacker}`);
      damagedBots.push(defender);
    }

    if (!commands.length) {
      return { waitedMs: warmupMs, damagedBots: [] };
    }

    this.executeServerCommands(run.serverId, commands);
    await this.sleep(1_500);
    return {
      waitedMs: warmupMs + 1_500,
      damagedBots,
    };
  }

  private collectPvpStageObservation(
    run: LocalValidationRunDto,
    batch: ValidationBatchContext,
    beforeDeaths: ReadonlyMap<string, number>,
    stageStart: number,
  ): PvpStageObservation {
    const recentEvents = this.botRealtime.getRecentBotEvents({
      validationRunId: run.id,
      batchId: batch.batchId,
      limit: 1_000,
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

  private resolvePvpStageRespawnGraceMs(): number {
    return process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'] === 'smoke' ? PVP_STAGE_RESPAWN_GRACE_MS : 0;
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

  private positionDistance(
    from: Pick<BotSnapshot, 'x' | 'y' | 'z'>,
    to: Pick<BotSnapshot, 'x' | 'y' | 'z'>,
  ): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private async waitForSpawnedBots(botNames: readonly string[], timeoutMs: number): Promise<number> {
    const deadline = Date.now() + timeoutMs;
    let spawnedBots = 0;
    do {
      spawnedBots = this.botState
        .allBots()
        .filter((bot) => botNames.includes(bot.name) && SPAWNED_STATES.has(bot.state))
        .length;
      if (spawnedBots >= botNames.length || timeoutMs <= 0) {
        return spawnedBots;
      }

      await this.sleep(SCENARIO_POLL_INTERVAL_MS);
    } while (Date.now() < deadline);

    return spawnedBots;
  }

  private async appendScenarioReport(
    run: LocalValidationRunDto,
    assertions: readonly { key: string; status: string }[],
  ): Promise<void> {
    const report = this.validationReport.buildReport({
      run: {
        id: run.id,
        status: run.status,
        scenarioPackId: run.scenarioPackId,
        serverId: run.serverId,
        paperVersion: run.paperVersion,
      },
      startup: {
        readyChecks: ['managed-server-config-created', 'lifecycle-start-success', 'ready-state-persisted'],
      },
      assertions,
    });

    await this.validationEvidence.appendOperationEvidence(run.id, '场景报告', { report });
  }

  private async updateRunStatusAndEmit(
    runId: string,
    status: LocalValidationRunDto['status'],
    patch: Record<string, unknown> = {},
  ): Promise<LocalValidationRunDto> {
    const run = await this.store.updateRunStatus(runId, status, patch);
    this.eventBus.emit('local-validation.run', {
      runId: run.id,
      status: run.status,
      serverId: run.serverId,
      paperVersion: run.paperVersion,
      failureCode: run.failureCode,
      failureMessage: run.failureMessage,
      timestamp: Date.now(),
    });
    return run;
  }

  private emitStage(stage: LocalValidationStageDto): void {
    this.eventBus.emit('local-validation.stage', {
      runId: stage.runId,
      stageId: stage.id,
      stageKey: stage.stageKey,
      title: stage.title,
      status: stage.status,
      assertionSummary: stage.assertionSummary,
      timestamp: Date.now(),
    });
  }

  private emitAssertions(runId: string, stageId: string, assertions: readonly { id: string; key: string; status: string }[]): void {
    for (const assertion of assertions) {
      this.eventBus.emit('local-validation.assertion', {
        runId,
        stageId,
        assertionId: assertion.id,
        key: assertion.key,
        status: assertion.status,
        timestamp: Date.now(),
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    if (ms <= 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
