import { afterEach, describe, expect, it } from 'vitest';
import { ScenarioCatalogService } from '../scenario-catalog.service.js';

describe('ScenarioCatalogService', () => {
  const originalProfile = process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'];

  afterEach(() => {
    if (originalProfile === undefined) {
      delete process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'];
      return;
    }
    process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'] = originalProfile;
  });

  it('keeps production defaults when no smoke profile is enabled', () => {
    delete process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'];
    const service = new ScenarioCatalogService();

    const pack = service.getScenarioPackDefinition('combat-pack-v1');

    expect(pack.stages.map((stage) => ({
      key: stage.key,
      behaviorTemplate: stage.behaviorTemplate,
      durationSec: stage.durationSec,
      threshold: stage.threshold,
    }))).toEqual([
      { key: 'spawn-and-stabilize', behaviorTemplate: 'idle', durationSec: 45, threshold: 1 },
      { key: 'movement-and-chat', behaviorTemplate: 'patrol', durationSec: 90, threshold: 0.9 },
      { key: 'gather-and-place', behaviorTemplate: 'gather', durationSec: 120, threshold: 0.75 },
      { key: 'pvp-damage-death-respawn', behaviorTemplate: 'attack', durationSec: 150, threshold: 0.75 },
    ]);
  });

  it('applies the smoke profile to shorten stage durations, relax smoke-only thresholds, and switch movement to move-random', () => {
    process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'] = 'smoke';
    const service = new ScenarioCatalogService();

    const pack = service.getScenarioPackDefinition('combat-pack-v1');

    expect(pack.stages.map((stage) => ({
      key: stage.key,
      behaviorTemplate: stage.behaviorTemplate,
      durationSec: stage.durationSec,
      threshold: stage.threshold,
    }))).toEqual([
      { key: 'spawn-and-stabilize', behaviorTemplate: 'idle', durationSec: 15, threshold: 1 },
      { key: 'movement-and-chat', behaviorTemplate: 'move-random', durationSec: 20, threshold: 0.9 },
      { key: 'gather-and-place', behaviorTemplate: 'gather', durationSec: 30, threshold: 0.5 },
      { key: 'pvp-damage-death-respawn', behaviorTemplate: 'attack', durationSec: 45, threshold: 0.5 },
    ]);
  });
});
