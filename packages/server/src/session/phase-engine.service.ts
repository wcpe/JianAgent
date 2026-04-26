import { Injectable, Logger } from '@nestjs/common';
import { BotOrchestratorService } from '../bot/bot-orchestrator.service';
import { SessionService } from './session.service';
import { ValidationRunService } from '../validation/validation-run.service';
import { ValidationPlanService } from '../validation/validation-plan.service';
import type { ValidationRunDto } from '../validation/validation.types';

interface PhaseConfig {
  readonly phase: string;
  readonly botCount: number;
  readonly behavior: string;
  readonly durationSec: number;
}

interface RunningSession {
  readonly sessionId: string;
  readonly serverId: string;
  readonly namePrefix: string;
  readonly phases: readonly PhaseConfig[];
  currentPhaseIndex: number;
  phaseTimer: ReturnType<typeof setTimeout> | null;
  phaseStartedAt: string;
  /** Associated validation run (if started via validation module) */
  validationRunId: string | null;
  /** Accumulated phase metrics for writing back to validation run */
  phaseMetrics: Record<string, unknown>[];
}

@Injectable()
export class PhaseEngineService {
  private readonly logger = new Logger(PhaseEngineService.name);
  private readonly runningSessions = new Map<string, RunningSession>();

  constructor(
    private readonly orchestrator: BotOrchestratorService,
    private readonly sessionService: SessionService,
    private readonly validationRunService: ValidationRunService,
    private readonly validationPlanService: ValidationPlanService,
  ) {}

  /**
   * Backward-compatible start — internally creates a validation plan + run
   * so the lifecycle is tracked through the unified validation executor.
   */
  async start(
    sessionId: string,
    serverId: string,
    namePrefix: string,
    phases: readonly PhaseConfig[],
  ): Promise<void> {
    // Create an implicit validation plan for this session
    const plan = await this.validationPlanService.create({
      name: `Session ${sessionId}`,
      serverId,
      type: 'custom',
      config: { phases: phases as unknown as readonly Record<string, unknown>[] },
    });

    const run = await this.validationRunService.create(plan.id, serverId);
    const startedRun = await this.validationRunService.start(run.id);

    await this.doStart(sessionId, serverId, namePrefix, phases, startedRun);
  }

  /**
   * Start from an already-created ValidationRunDto (new unified path).
   * Extracts phases from the linked plan config.
   */
  async startFromRun(run: ValidationRunDto, namePrefix: string): Promise<void> {
    const plan = await this.validationPlanService.findById(run.planId);
    if (!plan) {
      throw new Error(`Validation plan ${run.planId} not found`);
    }

    const configPhases = (plan.config?.phases ?? []) as Record<string, unknown>[];
    const phases: PhaseConfig[] = configPhases.map((p) => ({
      phase: (p.name ?? p.phase ?? 'default') as string,
      botCount: (p.botCount ?? 1) as number,
      behavior: (p.behavior ?? 'idle') as string,
      durationSec: (p.durationSec ?? 60) as number,
    }));

    const sessionId = `sess_vr_${run.id}`;
    await this.sessionService.create({
      name: `Validation ${run.id}`,
      serverId: run.serverId,
      botConfigId: 'default',
      phases,
    });

    // Transition run to running if still pending
    if (run.status === 'pending') {
      await this.validationRunService.start(run.id);
    }

    await this.doStart(sessionId, run.serverId, namePrefix, phases, run);
  }

  private async doStart(
    sessionId: string,
    serverId: string,
    namePrefix: string,
    phases: readonly PhaseConfig[],
    run: ValidationRunDto | null,
  ): Promise<void> {
    const running: RunningSession = {
      sessionId,
      serverId,
      namePrefix,
      phases,
      currentPhaseIndex: 0,
      phaseTimer: null,
      phaseStartedAt: new Date().toISOString(),
      validationRunId: run?.id ?? null,
      phaseMetrics: [],
    };
    this.runningSessions.set(sessionId, running);

    await this.sessionService.updateState(sessionId, 'RUNNING', {
      startedAt: running.phaseStartedAt,
      currentPhase: phases[0]?.phase ?? null,
    });

    this.executePhase(running);
  }

  async stop(sessionId: string): Promise<void> {
    const running = this.runningSessions.get(sessionId);
    if (!running) return;

    if (running.phaseTimer) clearTimeout(running.phaseTimer);
    this.orchestrator.stopAll();
    this.runningSessions.delete(sessionId);

    await this.sessionService.updateState(sessionId, 'FINISHED', {
      finishedAt: new Date().toISOString(),
    });

    // Complete or cancel the associated validation run
    if (running.validationRunId) {
      try {
        await this.validationRunService.complete(
          running.validationRunId,
          `Session ${sessionId} completed ${running.phaseMetrics.length} phases`,
          { phases: running.phaseMetrics },
        );
      } catch (err) {
        this.logger.warn(
          `Failed to complete validation run ${running.validationRunId}: ${(err as Error).message}`,
        );
      }
    }
  }

  private executePhase(running: RunningSession): void {
    const phase = running.phases[running.currentPhaseIndex];
    if (!phase) {
      this.stop(running.sessionId);
      return;
    }

    running.phaseStartedAt = new Date().toISOString();
    this.logger.log(
      `Session ${running.sessionId}: starting phase "${phase.phase}" (${phase.botCount} bots, ${phase.behavior})`,
    );

    this.orchestrator.createBotBatch({
      serverId: running.serverId,
      namePrefix: running.namePrefix,
      count: phase.botCount,
      behavior: phase.behavior,
      validationRunId: running.validationRunId ?? undefined,
    });

    running.phaseTimer = setTimeout(async () => {
      const finishedAt = new Date().toISOString();
      const startMs = new Date(running.phaseStartedAt).getTime();
      const endMs = new Date(finishedAt).getTime();
      const durationMs = endMs - startMs;

      // Record phase to session service (backward-compatible)
      await this.sessionService.recordPhase(running.sessionId, {
        phase: phase.phase,
        startedAt: running.phaseStartedAt,
        finishedAt,
        durationMs,
        botCount: phase.botCount,
        behavior: phase.behavior,
      });

      // Accumulate phase metrics for validation run context
      running.phaseMetrics.push({
        phase: phase.phase,
        index: running.currentPhaseIndex,
        startedAt: running.phaseStartedAt,
        finishedAt,
        durationMs,
        botCount: phase.botCount,
        behavior: phase.behavior,
      });

      running.currentPhaseIndex++;
      if (running.currentPhaseIndex < running.phases.length) {
        await this.sessionService.updateState(running.sessionId, 'RUNNING', {
          currentPhase: running.phases[running.currentPhaseIndex].phase,
        });
        this.executePhase(running);
      } else {
        await this.stop(running.sessionId);
      }
    }, phase.durationSec * 1000);
  }

  /** Fail the associated validation run on error. */
  async fail(sessionId: string, error: string): Promise<void> {
    const running = this.runningSessions.get(sessionId);
    if (!running) return;

    if (running.phaseTimer) clearTimeout(running.phaseTimer);
    this.orchestrator.stopAll();
    this.runningSessions.delete(sessionId);

    await this.sessionService.updateState(sessionId, 'FAILED', {
      finishedAt: new Date().toISOString(),
    });

    if (running.validationRunId) {
      try {
        await this.validationRunService.fail(running.validationRunId, error);
      } catch (err) {
        this.logger.warn(
          `Failed to fail validation run ${running.validationRunId}: ${(err as Error).message}`,
        );
      }
    }
  }

  /** Check if a session has a running phase engine. */
  isRunning(sessionId: string): boolean {
    return this.runningSessions.has(sessionId);
  }

  /** Get the validation run id associated with a running session. */
  getValidationRunId(sessionId: string): string | null {
    return this.runningSessions.get(sessionId)?.validationRunId ?? null;
  }
}
