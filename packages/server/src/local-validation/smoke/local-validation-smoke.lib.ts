import type {
  LocalValidationAssertionDto,
  LocalValidationEvidenceDto,
  LocalValidationRunDto,
  LocalValidationStageDto,
} from '@jian-agent/shared-domain';

export interface LocalValidationSmokeOptions {
  readonly runName: string;
  readonly scenarioPackId: string;
  readonly paperVersion: string;
  readonly requestedBotCount: number;
  readonly timeoutMs: number;
  readonly pollIntervalMs: number;
  readonly scenarioProfile: 'default' | 'smoke';
  readonly keepServerRunning: boolean;
  readonly keepWorkspace: boolean;
  readonly keepDatabase: boolean;
}

export interface LocalValidationSmokeVerdict {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly summary: {
    readonly runId: string;
    readonly status: string;
    readonly stageStatuses: Record<string, string>;
    readonly assertionStatuses: Record<string, string>;
    readonly evidenceSummaries: readonly string[];
  };
}

export function prepareLocalValidationSmokeEnvironment(
  env: NodeJS.ProcessEnv,
  input: {
    readonly dbPath: string;
    readonly scenarioProfile: LocalValidationSmokeOptions['scenarioProfile'];
  },
): NodeJS.ProcessEnv {
  env['DB_PATH'] ??= input.dbPath;
  env['LOCAL_VALIDATION_SCENARIO_PROFILE'] ??= input.scenarioProfile;
  env['PLUGIN_BRIDGE_DISABLED'] ??= 'true';
  return env;
}

const REQUIRED_STAGE_KEYS = [
  'spawn-and-stabilize',
  'movement-and-chat',
  'gather-and-place',
  'pvp-damage-death-respawn',
] as const;

const REQUIRED_ASSERTION_KEYS = [
  'spawn-stability-ratio',
  'movement-chat-ratio',
  'gather-place-ratio',
  'pvp-respawn-ratio',
] as const;

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function readLocalValidationSmokeOptions(env: NodeJS.ProcessEnv): LocalValidationSmokeOptions {
  return {
    runName: env['LOCAL_VALIDATION_SMOKE_RUN_NAME'] ?? 'Paper real smoke',
    scenarioPackId: env['LOCAL_VALIDATION_SMOKE_SCENARIO_PACK_ID'] ?? 'combat-pack-v1',
    paperVersion: env['LOCAL_VALIDATION_SMOKE_PAPER_VERSION'] ?? '1.21.1',
    requestedBotCount: parsePositiveInteger(env['LOCAL_VALIDATION_SMOKE_BOT_COUNT'], 2),
    timeoutMs: parsePositiveInteger(env['LOCAL_VALIDATION_SMOKE_TIMEOUT_MS'], 6 * 60 * 1000),
    pollIntervalMs: parsePositiveInteger(env['LOCAL_VALIDATION_SMOKE_POLL_INTERVAL_MS'], 1000),
    scenarioProfile: env['LOCAL_VALIDATION_SMOKE_SCENARIO_PROFILE'] === 'default' ? 'default' : 'smoke',
    keepServerRunning: parseBoolean(env['LOCAL_VALIDATION_SMOKE_KEEP_SERVER'], false),
    keepWorkspace: parseBoolean(env['LOCAL_VALIDATION_SMOKE_KEEP_WORKSPACE'], false),
    keepDatabase: parseBoolean(env['LOCAL_VALIDATION_SMOKE_KEEP_DB'], false),
  };
}

export function validateLocalValidationSmokeOutcome(input: {
  readonly run: LocalValidationRunDto;
  readonly stages: readonly LocalValidationStageDto[];
  readonly assertions: readonly LocalValidationAssertionDto[];
  readonly evidence: readonly LocalValidationEvidenceDto[];
}): LocalValidationSmokeVerdict {
  const errors: string[] = [];
  const stageStatuses = Object.fromEntries(input.stages.map((stage) => [stage.stageKey, stage.status]));
  const assertionStatuses = Object.fromEntries(input.assertions.map((assertion) => [assertion.key, assertion.status]));
  const evidenceSummaries = input.evidence.map((item) => item.summary);

  if (input.run.status !== 'PASSED') {
    errors.push(`Run ended with status ${input.run.status} instead of PASSED`);
  }

  for (const stageKey of REQUIRED_STAGE_KEYS) {
    const stage = input.stages.find((item) => item.stageKey === stageKey);
    if (!stage) {
      errors.push(`Missing stage: ${stageKey}`);
      continue;
    }

    if (stage.status !== 'passed') {
      errors.push(`Stage ${stageKey} ended with status ${stage.status}`);
    }
  }

  for (const assertionKey of REQUIRED_ASSERTION_KEYS) {
    const assertion = input.assertions.find((item) => item.key === assertionKey);
    if (!assertion) {
      errors.push(`Missing assertion: ${assertionKey}`);
      continue;
    }

    if (assertion.status !== 'passed') {
      errors.push(`Assertion ${assertionKey} ended with status ${assertion.status}`);
    }
  }

  if (!input.evidence.some((item) => item.summary === '场景报告' && item.kind === 'operation')) {
    errors.push('Missing final report evidence: 场景报告');
  }

  const gatherEvidence = input.evidence.find((item) => item.summary === '采集与放置检查' && item.kind === 'bot-event');
  if (!gatherEvidence) {
    errors.push('Missing gather evidence: 采集与放置检查');
  } else {
    const placedBots = Number(gatherEvidence.payload['placedBots'] ?? 0);
    if (!Number.isFinite(placedBots) || placedBots < 1) {
      errors.push('Gather stage did not record a real placement success');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      runId: input.run.id,
      status: input.run.status,
      stageStatuses,
      assertionStatuses,
      evidenceSummaries,
    },
  };
}
