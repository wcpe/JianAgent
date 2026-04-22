import { describe, expect, it } from 'vitest';
import { ScenarioAssertionService } from '../scenario-assertion.service';

describe('ScenarioAssertionService', () => {
  it('passes the death-respawn assertion when threshold is met', () => {
    const service = new ScenarioAssertionService();
    const result = service.evaluateStage('pvp-damage-death-respawn', {
      spawnedBots: 8,
      respawnedBots: 7,
      threshold: 0.75,
    });

    expect(result.status).toBe('passed');
    expect(result.actual).toBe(0.875);
  });

  it('fails the gather-and-place assertion when the actual ratio is below threshold', () => {
    const service = new ScenarioAssertionService();
    const result = service.evaluateStage('gather-and-place', {
      actual: 0.6,
      threshold: 0.75,
    });

    expect(result.status).toBe('failed');
    expect(result.summary).toMatchObject({ total: 1, passed: 0, failed: 1 });
    expect(result.assertions[0]).toMatchObject({
      key: 'gather-place-ratio',
      actual: 0.6,
      threshold: 0.75,
    });
  });

  it('fails movement-and-chat when only movement passes', () => {
    const service = new ScenarioAssertionService();
    const result = service.evaluateStage('movement-and-chat', {
      spawnedBots: 10,
      movingBots: 5,
      movingGroupSize: 5,
      chattingBots: 4,
      chattingGroupSize: 5,
      threshold: 0.9,
    });

    expect(result.status).toBe('failed');
    expect(result.actual).toBe(0.8);
  });

  it('passes movement-and-chat when both dedicated groups meet the threshold', () => {
    const service = new ScenarioAssertionService();
    const result = service.evaluateStage('movement-and-chat', {
      spawnedBots: 4,
      movingBots: 2,
      movingGroupSize: 2,
      chattingBots: 2,
      chattingGroupSize: 2,
      threshold: 0.9,
    });

    expect(result.status).toBe('passed');
    expect(result.actual).toBe(1);
  });

  it('fails gather-and-place when only gather passes', () => {
    const service = new ScenarioAssertionService();
    const result = service.evaluateStage('gather-and-place', {
      spawnedBots: 10,
      gatheredBots: 8,
      placedBots: 4,
      threshold: 0.75,
    });

    expect(result.status).toBe('failed');
    expect(result.actual).toBe(0.4);
  });
});
