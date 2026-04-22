import { Injectable } from '@nestjs/common';
import type {
  LocalValidationAssertionDto,
  LocalValidationAssertionStatus,
} from '@jian-agent/shared-domain';

type BuiltInStageKey =
  | 'spawn-and-stabilize'
  | 'movement-and-chat'
  | 'gather-and-place'
  | 'pvp-damage-death-respawn';

interface StageMetricsInput {
  readonly threshold: number;
  readonly actual?: number;
  readonly spawnedBots?: number;
  readonly stabilizedBots?: number;
  readonly movingBots?: number;
  readonly movingGroupSize?: number;
  readonly chattingBots?: number;
  readonly chattingGroupSize?: number;
  readonly gatheredBots?: number;
  readonly placedBots?: number;
  readonly respawnedBots?: number;
}

export interface ScenarioAssertionEvaluation {
  readonly assertions: readonly LocalValidationAssertionDto[];
  readonly summary: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
  };
  readonly status: LocalValidationAssertionStatus;
  readonly actual: number;
}

function asStatus(passed: boolean): LocalValidationAssertionStatus {
  return passed ? 'passed' : 'failed';
}

@Injectable()
export class ScenarioAssertionService {
  evaluateStage(stageKey: BuiltInStageKey, input: StageMetricsInput): ScenarioAssertionEvaluation {
    const actual = this.resolveActual(stageKey, input);
    const status = asStatus(actual >= input.threshold);

    const assertion: LocalValidationAssertionDto = {
      id: `assert-${stageKey}`,
      runId: '',
      stageId: '',
      key: this.resolveAssertionKey(stageKey),
      title: this.resolveTitle(stageKey),
      required: true,
      status,
      threshold: input.threshold,
      actual,
      message: this.resolveMessage(stageKey, actual, input.threshold, status),
      evidenceRefs: [],
    };

    return {
      assertions: [assertion],
      summary: {
        total: 1,
        passed: status === 'passed' ? 1 : 0,
        failed: status === 'failed' ? 1 : 0,
      },
      status,
      actual,
    };
  }

  private resolveActual(stageKey: BuiltInStageKey, input: StageMetricsInput): number {
    if (typeof input.actual === 'number') {
      return input.actual;
    }

    if (stageKey === 'pvp-damage-death-respawn') {
      if (!input.spawnedBots) return 0;
      return input.respawnedBots ? input.respawnedBots / input.spawnedBots : 0;
    }

    if (stageKey === 'spawn-and-stabilize') {
      if (!input.spawnedBots) return 0;
      return (input.stabilizedBots ?? 0) / input.spawnedBots;
    }

    if (stageKey === 'movement-and-chat') {
      const movingGroupSize = input.movingGroupSize ?? input.spawnedBots ?? 0;
      const chattingGroupSize = input.chattingGroupSize ?? input.spawnedBots ?? 0;
      if (!movingGroupSize || !chattingGroupSize) return 0;
      const movedRatio = (input.movingBots ?? 0) / movingGroupSize;
      const chatRatio = (input.chattingBots ?? 0) / chattingGroupSize;
      return Math.min(movedRatio, chatRatio);
    }

    if (stageKey === 'gather-and-place') {
      if (!input.spawnedBots) return 0;
      const gatheredRatio = (input.gatheredBots ?? 0) / input.spawnedBots;
      const placedRatio = (input.placedBots ?? 0) / input.spawnedBots;
      return Math.min(gatheredRatio, placedRatio);
    }

    return 0;
  }

  private resolveAssertionKey(stageKey: BuiltInStageKey): string {
    switch (stageKey) {
      case 'spawn-and-stabilize':
        return 'spawn-stability-ratio';
      case 'movement-and-chat':
        return 'movement-chat-ratio';
      case 'gather-and-place':
        return 'gather-place-ratio';
      case 'pvp-damage-death-respawn':
        return 'pvp-respawn-ratio';
    }
  }

  private resolveTitle(stageKey: BuiltInStageKey): string {
    switch (stageKey) {
      case 'spawn-and-stabilize':
        return 'Spawn and Stabilize';
      case 'movement-and-chat':
        return 'Movement and Chat';
      case 'gather-and-place':
        return 'Gather and Place';
      case 'pvp-damage-death-respawn':
        return 'PvP Damage, Death, and Respawn';
    }
  }

  private resolveMessage(
    stageKey: BuiltInStageKey,
    actual: number,
    threshold: number,
    status: LocalValidationAssertionStatus,
  ): string {
    const comparator = status === 'passed' ? '>=' : '<';
    return `${this.resolveTitle(stageKey)} ${actual.toFixed(3)} ${comparator} ${threshold.toFixed(3)}`;
  }
}
