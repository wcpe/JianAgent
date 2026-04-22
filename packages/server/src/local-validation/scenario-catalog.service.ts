import { Injectable } from '@nestjs/common';
export type ScenarioStageDefinition = {
  readonly key: string;
  readonly behaviorTemplate: string;
  readonly durationSec: number;
  readonly threshold: number;
  readonly title: string;
  readonly assertionKey: string;
};

type ScenarioPackPublicDto = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly stages: readonly {
    readonly key: string;
    readonly behaviorTemplate: string;
    readonly durationSec: number;
    readonly threshold: number;
  }[];
};

export type ScenarioPackDefinition = Omit<ScenarioPackPublicDto, 'stages'> & {
  readonly stages: readonly ScenarioStageDefinition[];
};

const BUILT_IN_SCENARIO_PACKS: readonly ScenarioPackDefinition[] = [
  {
    id: 'combat-pack-v1',
    name: '综合对抗验收包',
    description: '覆盖出生、移动、聊天、交互、PvP、死亡、重生',
    stages: [
      {
        key: 'spawn-and-stabilize',
        title: 'Spawn and Stabilize',
        assertionKey: 'spawn-stability-ratio',
        behaviorTemplate: 'idle',
        durationSec: 45,
        threshold: 1,
      },
      {
        key: 'movement-and-chat',
        title: 'Movement and Chat',
        assertionKey: 'movement-chat-ratio',
        behaviorTemplate: 'patrol',
        durationSec: 90,
        threshold: 0.9,
      },
      {
        key: 'gather-and-place',
        title: 'Gather and Place',
        assertionKey: 'gather-place-ratio',
        behaviorTemplate: 'gather',
        durationSec: 120,
        threshold: 0.75,
      },
      {
        key: 'pvp-damage-death-respawn',
        title: 'PvP Damage, Death, and Respawn',
        assertionKey: 'pvp-respawn-ratio',
        behaviorTemplate: 'attack',
        durationSec: 150,
        threshold: 0.75,
      },
    ],
  },
] as const;

const SMOKE_STAGE_OVERRIDES = new Map<string, {
  readonly durationSec: number;
  readonly threshold?: number;
  readonly behaviorTemplate?: string;
}>([
  ['spawn-and-stabilize', { durationSec: 15, threshold: 1 }],
  ['movement-and-chat', { durationSec: 20, threshold: 0.9, behaviorTemplate: 'move-random' }],
  ['gather-and-place', { durationSec: 30, threshold: 0.5 }],
  ['pvp-damage-death-respawn', { durationSec: 45, threshold: 0.5 }],
]);

@Injectable()
export class ScenarioCatalogService {
  listScenarioPacks(): readonly ScenarioPackPublicDto[] {
    return BUILT_IN_SCENARIO_PACKS.map((pack) => this.toPublicPack(pack));
  }

  requireScenarioPack(packId: string): ScenarioPackPublicDto {
    const pack = BUILT_IN_SCENARIO_PACKS.find((entry) => entry.id === packId);
    if (!pack) {
      throw new Error(`Unknown local validation scenario pack: ${packId}`);
    }

    return this.toPublicPack(pack);
  }

  getScenarioPackDefinition(packId: string): ScenarioPackDefinition {
    const pack = BUILT_IN_SCENARIO_PACKS.find((entry) => entry.id === packId);
    if (!pack) {
      throw new Error(`Unknown local validation scenario pack: ${packId}`);
    }

    return this.applyRuntimeProfile(pack);
  }

  private applyRuntimeProfile(pack: ScenarioPackDefinition): ScenarioPackDefinition {
    if (process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'] !== 'smoke') {
      return pack;
    }

    return {
      ...pack,
      stages: pack.stages.map((stage) => {
        const override = SMOKE_STAGE_OVERRIDES.get(stage.key);
        if (!override) {
          return stage;
        }

        return {
          ...stage,
          behaviorTemplate: override.behaviorTemplate ?? stage.behaviorTemplate,
          durationSec: override.durationSec,
          threshold: override.threshold ?? stage.threshold,
        };
      }),
    };
  }

  private toPublicPack(pack: ScenarioPackDefinition): ScenarioPackPublicDto {
    return {
      id: pack.id,
      name: pack.name,
      description: pack.description,
      stages: pack.stages.map((stage) => ({
        key: stage.key,
        behaviorTemplate: stage.behaviorTemplate,
        durationSec: stage.durationSec,
        threshold: stage.threshold,
      })),
    };
  }
}
