import { describe, expect, it } from 'vitest';
import type {
  LocalValidationAssertionDto,
  LocalValidationEvidenceDto,
  LocalValidationRunDto,
  LocalValidationStageDto,
} from '@jian-agent/shared-domain';
import {
  prepareLocalValidationSmokeEnvironment,
  readLocalValidationSmokeOptions,
  validateLocalValidationSmokeOutcome,
} from '../smoke/local-validation-smoke.lib.js';

function createRun(overrides: Partial<LocalValidationRunDto> = {}): LocalValidationRunDto {
  return {
    id: 'lvr_smoke',
    name: 'Paper real smoke',
    mode: 'init-paper',
    status: 'PASSED',
    serverId: 'srv_smoke',
    paperVersion: '1.21.1',
    scenarioPackId: 'combat-pack-v1',
    requestedBotCount: 2,
    effectiveBotCount: 2,
    requestedBy: 'smoke',
    keepServerRunning: false,
    keepWorkspace: false,
    workspacePath: '/tmp/lvr_smoke',
    startedAt: '2026-04-20T00:00:00.000Z',
    finishedAt: '2026-04-20T00:02:00.000Z',
    ...overrides,
  };
}

function createStage(stageKey: string): LocalValidationStageDto {
  return {
    id: `stage_${stageKey}`,
    runId: 'lvr_smoke',
    stageKey,
    title: stageKey,
    status: 'passed',
    timeoutMs: 1000,
    startedAt: '2026-04-20T00:00:00.000Z',
    finishedAt: '2026-04-20T00:00:01.000Z',
    botGroupSnapshot: [],
    assertionSummary: {
      total: 1,
      passed: 1,
      failed: 0,
    },
  };
}

function createAssertion(key: string): LocalValidationAssertionDto {
  return {
    id: `assert_${key}`,
    runId: 'lvr_smoke',
    stageId: 'stage',
    key,
    title: key,
    required: true,
    status: 'passed',
    threshold: 0.5,
    actual: 1,
    message: key,
    evidenceRefs: [],
  };
}

function createEvidence(
  summary: string,
  kind: LocalValidationEvidenceDto['kind'],
  payload: Record<string, unknown> = {},
): LocalValidationEvidenceDto {
  return {
    id: `evidence_${summary}`,
    runId: 'lvr_smoke',
    kind,
    timestamp: '2026-04-20T00:02:00.000Z',
    summary,
    payload,
  };
}

describe('local validation smoke helpers', () => {
  it('reads smoke options with defaults suited for the real Paper smoke runner', () => {
    const options = readLocalValidationSmokeOptions({});

    expect(options).toMatchObject({
      scenarioPackId: 'combat-pack-v1',
      paperVersion: '1.21.1',
      requestedBotCount: 2,
      timeoutMs: 6 * 60 * 1000,
      pollIntervalMs: 1000,
      scenarioProfile: 'smoke',
      keepServerRunning: false,
      keepWorkspace: false,
      keepDatabase: false,
    });
  });

  it('respects explicit environment overrides when reading smoke options', () => {
    const options = readLocalValidationSmokeOptions({
      LOCAL_VALIDATION_SMOKE_BOT_COUNT: '4',
      LOCAL_VALIDATION_SMOKE_TIMEOUT_MS: '900000',
      LOCAL_VALIDATION_SMOKE_PAPER_VERSION: '1.21.8',
      LOCAL_VALIDATION_SMOKE_SCENARIO_PROFILE: 'default',
      LOCAL_VALIDATION_SMOKE_KEEP_SERVER: 'true',
      LOCAL_VALIDATION_SMOKE_KEEP_WORKSPACE: '1',
      LOCAL_VALIDATION_SMOKE_KEEP_DB: 'yes',
    });

    expect(options).toMatchObject({
      requestedBotCount: 4,
      timeoutMs: 900000,
      paperVersion: '1.21.8',
      scenarioProfile: 'default',
      keepServerRunning: true,
      keepWorkspace: true,
      keepDatabase: true,
    });
  });

  it('defaults the smoke runtime environment to an isolated bridge-disabled profile', () => {
    const env: NodeJS.ProcessEnv = {};

    prepareLocalValidationSmokeEnvironment(env, {
      dbPath: '/tmp/local-validation-smoke.db',
      scenarioProfile: 'smoke',
    });

    expect(env).toMatchObject({
      DB_PATH: '/tmp/local-validation-smoke.db',
      LOCAL_VALIDATION_SCENARIO_PROFILE: 'smoke',
      PLUGIN_BRIDGE_DISABLED: 'true',
    });
  });

  it('preserves explicit smoke runtime environment overrides', () => {
    const env: NodeJS.ProcessEnv = {
      DB_PATH: '/tmp/existing.db',
      LOCAL_VALIDATION_SCENARIO_PROFILE: 'default',
      PLUGIN_BRIDGE_DISABLED: 'false',
    };

    prepareLocalValidationSmokeEnvironment(env, {
      dbPath: '/tmp/new.db',
      scenarioProfile: 'smoke',
    });

    expect(env).toMatchObject({
      DB_PATH: '/tmp/existing.db',
      LOCAL_VALIDATION_SCENARIO_PROFILE: 'default',
      PLUGIN_BRIDGE_DISABLED: 'false',
    });
  });

  it('accepts a passed run that contains all expected stages, assertions, and final report evidence', () => {
    const verdict = validateLocalValidationSmokeOutcome({
      run: createRun(),
      stages: [
        createStage('spawn-and-stabilize'),
        createStage('movement-and-chat'),
        createStage('gather-and-place'),
        createStage('pvp-damage-death-respawn'),
      ],
      assertions: [
        createAssertion('spawn-stability-ratio'),
        createAssertion('movement-chat-ratio'),
        createAssertion('gather-place-ratio'),
        createAssertion('pvp-respawn-ratio'),
      ],
      evidence: [
        createEvidence('出生稳定性检查', 'bot-event'),
        createEvidence('移动与聊天检查', 'bot-event'),
        createEvidence('采集与放置检查', 'bot-event', {
          gatheredBots: 2,
          placedBots: 2,
        }),
        createEvidence('PvP 与重生检查', 'bot-event'),
        createEvidence('场景报告', 'operation'),
      ],
    });

    expect(verdict.ok).toBe(true);
    expect(verdict.errors).toHaveLength(0);
    expect(verdict.summary.stageStatuses).toEqual({
      'spawn-and-stabilize': 'passed',
      'movement-and-chat': 'passed',
      'gather-and-place': 'passed',
      'pvp-damage-death-respawn': 'passed',
    });
  });

  it('rejects incomplete smoke outcomes and reports the missing artifacts', () => {
    const verdict = validateLocalValidationSmokeOutcome({
      run: createRun({ status: 'FAILED_SCENARIO' }),
      stages: [
        createStage('spawn-and-stabilize'),
        { ...createStage('movement-and-chat'), status: 'failed' },
      ],
      assertions: [
        createAssertion('spawn-stability-ratio'),
      ],
      evidence: [],
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.errors).toEqual(expect.arrayContaining([
      'Run ended with status FAILED_SCENARIO instead of PASSED',
      'Stage movement-and-chat ended with status failed',
      'Missing stage: gather-and-place',
      'Missing stage: pvp-damage-death-respawn',
      'Missing assertion: movement-chat-ratio',
      'Missing final report evidence: 场景报告',
    ]));
  });

  it('rejects smoke outcomes when gather evidence does not contain a real placement success', () => {
    const verdict = validateLocalValidationSmokeOutcome({
      run: createRun(),
      stages: [
        createStage('spawn-and-stabilize'),
        createStage('movement-and-chat'),
        createStage('gather-and-place'),
        createStage('pvp-damage-death-respawn'),
      ],
      assertions: [
        createAssertion('spawn-stability-ratio'),
        createAssertion('movement-chat-ratio'),
        createAssertion('gather-place-ratio'),
        createAssertion('pvp-respawn-ratio'),
      ],
      evidence: [
        createEvidence('出生稳定性检查', 'bot-event'),
        createEvidence('移动与聊天检查', 'bot-event'),
        createEvidence('采集与放置检查', 'bot-event', {
          gatheredBots: 2,
          placedBots: 0,
        }),
        createEvidence('PvP 与重生检查', 'bot-event'),
        createEvidence('场景报告', 'operation'),
      ],
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.errors).toContain('Gather stage did not record a real placement success');
  });
});
