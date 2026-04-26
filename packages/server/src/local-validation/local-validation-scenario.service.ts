import { Inject, Injectable, Logger } from '@nestjs/common';
import type { LocalValidationRunDto, LocalValidationStageDto } from '@jian-agent/shared-domain';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BotOrchestratorService } from '../bot/bot-orchestrator.service.js';
import { BotStateService, type BotSnapshot } from '../bot/bot-state.service.js';
import { LocalValidationStore } from './local-validation.store.js';
import { ScenarioCatalogService, type ScenarioPackDefinition, type ScenarioStageDefinition } from './scenario-catalog.service.js';
import { ScenarioAssertionService } from './scenario-assertion.service.js';
import { ScenarioEvidenceService } from './scenario-evidence.service.js';
import { PvpArenaService } from './pvp-arena.service.js';
import { ValidationEvidenceService } from './validation-evidence.service.js';
import { ValidationReportService } from './validation-report.service.js';
import { resolveBuildTarget, countInventoryItems, positionDistance } from './build-target.utils.js';
import { buildMovementStageBehavior, resolveMovementStageChatIntervalMs } from './movement-behavior.utils.js';
import { SPAWNED_STATES, SCENARIO_POLL_INTERVAL_MS, MOVEMENT_DISTANCE_THRESHOLD, GATHER_RADIUS, PVP_ATTACK_CHASE_RANGE, PVP_ATTACK_RANGE } from './scenario-constants.js';

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
}@Injectable()
export class LocalValidationScenarioService {
  private readonly logger = new Logger(LocalValidationScenarioService.name);

  constructor(
    private readonly store: LocalValidationStore,
    private readonly scenarioCatalog: ScenarioCatalogService,
    private readonly scenarioAssertions: ScenarioAssertionService,
    private readonly botOrchestrator: BotOrchestratorService,
    private readonly botState: BotStateService,
    private readonly validationEvidence: ValidationEvidenceService,
    private readonly validationReport: ValidationReportService,
    @Inject(EventEmitter2) private readonly eventBus: EventEmitter2,
    private readonly pvpArena: PvpArenaService,
    private readonly scenarioEvidence: ScenarioEvidenceService,
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
      const snapshot = this.botState.allBots().find((bot) => bot.name === botName);
      const movementBehavior = buildMovementStageBehavior(stage, snapshot);
      this.botOrchestrator.setBehavior(botName, movementBehavior.behavior, movementBehavior.params);
    }
    for (const botName of chattingGroup) {
      this.botOrchestrator.setBehavior(botName, 'chat', {
        messages: ['validation: ready', 'validation: patrol', 'validation: chat'],
        intervalMs: resolveMovementStageChatIntervalMs(),
      });
    }

    const stageStart = Date.now();
    await this.sleep(stage.durationSec * 1000);
    const movedBots = movingGroup.filter((botName) => {
      const before = initialPositions.get(botName);
      const after = this.botState.allBots().find((bot) => bot.name === botName);
      if (!before || !after) {
        return false;
      }
      return positionDistance(before, after) >= MOVEMENT_DISTANCE_THRESHOLD;
    }).length;

    const chatResult = this.scenarioEvidence.collectChattingBotCount(
      run.id, batch.batchId, stageStart, chattingGroup,
    );

    const evaluation = this.scenarioAssertions.evaluateStage('movement-and-chat', {
      threshold: stage.threshold,
      spawnedBots: batch.botNames.length,
      movingBots: movedBots,
      movingGroupSize: movingGroup.length,
      chattingBots: chatResult.chattingBots,
      chattingGroupSize: chattingGroup.length,
    });

    await this.validationEvidence.appendBotEventEvidence(run.id, '移动与聊天检查', {
      stageKey: stage.key,
      movedBots,
      chattingBots: chatResult.chattingBots,
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
      this.botOrchestrator.setBehavior(botName, 'gather', { blockTypes: ['grass_block', 'dirt'], radius: GATHER_RADIUS });
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
        const target = resolveBuildTarget(
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
    const buildTelemetry = this.scenarioEvidence.collectBuildTelemetry(run.id, batch.batchId, stageStart);
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
      const beforeInventoryCount = countInventoryItems(gatheredDetail?.inventory ?? [], target.blockName);
      const afterInventoryCount = countInventoryItems(detail.inventory, target.blockName);
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
    const preparation = await this.pvpArena.preparePvpStage(run, batch, attackers, defenders);
    const beforeDeaths = this.pvpArena.snapshotDeathCounts(batch.botNames);

    for (let index = 0; index < batch.botNames.length; index += 2) {
      const left = batch.botNames[index];
      const right = batch.botNames[index + 1];
      if (left && right) {
        this.botOrchestrator.setBehavior(left, 'attack', { target: right, chaseRange: PVP_ATTACK_CHASE_RANGE, attackRange: PVP_ATTACK_RANGE });
        this.botOrchestrator.setBehavior(right, 'attack', { target: left, chaseRange: PVP_ATTACK_CHASE_RANGE, attackRange: PVP_ATTACK_RANGE });
      } else if (left) {
        this.botOrchestrator.setBehavior(left, 'attack', { chaseRange: PVP_ATTACK_CHASE_RANGE, attackRange: PVP_ATTACK_RANGE });
      }
    }

    const stageStart = Date.now();
    const durationMs = stage.durationSec * 1000;
    const forcedSmokeDamage = await this.pvpArena.forceSmokePvpDamageIfNeeded(
      run, batch, attackers, defenders, beforeDeaths, stageStart, durationMs,
    );
    const remainingDurationMs = Math.max(durationMs - forcedSmokeDamage.waitedMs, 0);
    await this.sleep(remainingDurationMs);
    const observation = await this.pvpArena.observePvpStageOutcome(run, batch, beforeDeaths, stageStart);

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
    stage: ScenarioStageDefinition, botNames: readonly string[],
  ): LocalValidationStageDto['botGroupSnapshot'] {
    if (stage.key === 'movement-and-chat') {
      return [
        { name: 'patrol-group', botNames: botNames.filter((_, i) => i % 2 === 0) },
        { name: 'chat-group', botNames: botNames.filter((_, i) => i % 2 === 1) },
      ];
    }
    if (stage.key === 'pvp-damage-death-respawn') {
      return [
        { name: 'attackers', botNames: botNames.filter((_, i) => i % 2 === 0) },
        { name: 'defenders', botNames: botNames.filter((_, i) => i % 2 === 1) },
      ];
    }
    return [{ name: 'validation-bots', botNames: [...botNames] }];
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
