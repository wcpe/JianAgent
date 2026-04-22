import { describe, expect, it } from 'vitest';
import type {
  LocalValidationAssertionDto,
  LocalValidationEvidenceDto,
  LocalValidationRunDto,
  LocalValidationRunStatus,
  LocalValidationScenarioPackDto,
  LocalValidationStageDto,
} from '../index.js';

describe('local validation DTOs', () => {
  it('accepts the Task 1 run contract and status union', () => {
    const run: LocalValidationRunDto = {
      id: 'lvr_001',
      name: 'Paper startup smoke',
      mode: 'init-paper',
      status: 'FAILED_STARTUP',
      scenarioPackId: 'combat-pack-v1',
      requestedBotCount: 8,
      effectiveBotCount: 0,
      requestedBy: 'qa',
      keepServerRunning: false,
      keepWorkspace: true,
      workspacePath: '/tmp/jianagent/lvr_001',
      paperVersion: '1.21.1',
      failureCode: 'server_start_failed',
      failureMessage: 'Paper failed to boot',
      startedAt: '2026-04-19T10:00:00.000Z',
      finishedAt: '2026-04-19T10:05:00.000Z',
    };

    const status: LocalValidationRunStatus = run.status;

    expect(status).toBe('FAILED_STARTUP');
    expect(run.mode).toBe('init-paper');
  });

  it('accepts stage, assertion, and evidence DTOs with Task 1 shapes', () => {
    const stage: LocalValidationStageDto = {
      id: 'lvs_001',
      runId: 'lvr_001',
      stageKey: 'precheck',
      title: 'Precheck the local workspace',
      status: 'running',
      timeoutMs: 120000,
      botGroupSnapshot: [
        {
          name: 'alpha',
          botNames: ['bot-a', 'bot-b'],
        },
      ],
      assertionSummary: {
        total: 2,
        passed: 1,
        failed: 1,
      },
      startedAt: '2026-04-19T10:00:05.000Z',
    };

    const assertion: LocalValidationAssertionDto = {
      id: 'lva_001',
      runId: 'lvr_001',
      stageId: 'lvs_001',
      key: 'server-ready',
      title: 'Server reports ready',
      required: true,
      status: 'passed',
      threshold: 0.75,
      actual: 1,
      message: 'Server reached the ready state',
      evidenceRefs: ['lve_001'],
    };

    const evidence: LocalValidationEvidenceDto = {
      id: 'lve_001',
      runId: 'lvr_001',
      kind: 'server-log',
      timestamp: '2026-04-19T10:00:07.000Z',
      summary: 'Paper logged the ready banner',
      payload: {
        line: '[Server thread/INFO]: Done (3.1s)!',
      },
    };

    expect(stage.botGroupSnapshot[0]!.botNames).toEqual(['bot-a', 'bot-b']);
    expect(assertion.evidenceRefs).toEqual(['lve_001']);
    expect(evidence.payload.line).toContain('Done');
  });

  it('accepts a scenario pack with Task 1 stage definitions', () => {
    const scenarioPack: LocalValidationScenarioPackDto = {
      id: 'combat-pack-v1',
      name: 'Combat Validation Pack',
      description: 'Built-in local Minecraft combat validation scenarios',
      stages: [
        {
          key: 'precheck',
          behaviorTemplate: 'idle',
          durationSec: 45,
          threshold: 1,
        },
        {
          key: 'pvp-damage-death-respawn',
          behaviorTemplate: 'attack',
          durationSec: 150,
          threshold: 0.75,
        },
      ],
    };

    expect(scenarioPack.stages).toHaveLength(2);
    expect(scenarioPack.stages[1]!.threshold).toBe(0.75);
  });
});
