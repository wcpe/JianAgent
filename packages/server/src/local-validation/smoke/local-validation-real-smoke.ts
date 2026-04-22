import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import type { LocalValidationRunDto } from '@jian-agent/shared-domain';
import { AppModule } from '../../app.module.js';
import { ServerConfigService } from '../../server-process/server-config.service.js';
import { ServerLifecycleEngine } from '../../server-process/lifecycle/lifecycle-engine.service.js';
import { LOCAL_VALIDATION_WORKSPACE_PREFIX } from '../local-server-provisioning.service.js';
import { LocalValidationOrchestratorService } from '../local-validation-orchestrator.service.js';
import { LocalValidationStore } from '../local-validation.store.js';
import {
  prepareLocalValidationSmokeEnvironment,
  readLocalValidationSmokeOptions,
  validateLocalValidationSmokeOutcome,
} from './local-validation-smoke.lib.js';

const logger = new Logger('LocalValidationRealSmoke');
const TERMINAL_STATUSES = new Set<LocalValidationRunDto['status']>([
  'PASSED',
  'FAILED_PRECHECK',
  'FAILED_PROVISION',
  'FAILED_STARTUP',
  'FAILED_SCENARIO',
  'FAILED_RUNTIME',
  'CANCELLED',
  'FINISHED',
]);

async function ensureJavaAvailable(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('java', ['-version'], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`java -version exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

async function ensureBotWorkerBuilt(): Promise<void> {
  const workerEntryPath = require.resolve('@jian-agent/bot-worker');
  await access(workerEntryPath);
}

async function waitForTerminalRun(
  store: LocalValidationStore,
  runId: string,
  timeoutMs: number,
  pollIntervalMs: number,
): Promise<LocalValidationRunDto> {
  const deadline = Date.now() + timeoutMs;
  let current = await store.requireRun(runId);

  while (!TERMINAL_STATUSES.has(current.status)) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for local validation run ${runId} to finish; last status=${current.status}`);
    }
    await sleep(pollIntervalMs);
    current = await store.requireRun(runId);
  }

  return current;
}

async function cleanupArtifacts(input: {
  readonly lifecycle: ServerLifecycleEngine;
  readonly configService: ServerConfigService;
  readonly serverId?: string;
  readonly workspacePath?: string;
  readonly dbPath: string;
  readonly keepServerRunning: boolean;
  readonly keepWorkspace: boolean;
  readonly keepDatabase: boolean;
}): Promise<void> {
  if (input.serverId && !input.keepServerRunning) {
    try {
      await input.lifecycle.stop(input.serverId, false);
    } catch {
      try {
        await input.lifecycle.stop(input.serverId, true);
      } catch {
        // ignore cleanup errors; smoke verdict already captured
      }
    }

    try {
      await input.configService.delete(input.serverId);
    } catch {
      // ignore cleanup errors
    }
  }

  if (input.workspacePath && !input.keepWorkspace) {
    await rm(input.workspacePath, { recursive: true, force: true });
  }

  if (!input.keepDatabase) {
    await Promise.allSettled([
      rm(input.dbPath, { force: true }),
      rm(`${input.dbPath}-wal`, { force: true }),
      rm(`${input.dbPath}-shm`, { force: true }),
    ]);
  }
}

async function main(): Promise<void> {
  const options = readLocalValidationSmokeOptions(process.env);
  const dbPath = process.env['DB_PATH'] ?? join(tmpdir(), `jianagent-local-validation-smoke-${randomUUID()}.db`);
  prepareLocalValidationSmokeEnvironment(process.env, {
    dbPath,
    scenarioProfile: options.scenarioProfile,
  });

  await ensureJavaAvailable();
  await ensureBotWorkerBuilt();

  const workspacePath = await mkdtemp(join(tmpdir(), LOCAL_VALIDATION_WORKSPACE_PREFIX));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  let serverId: string | undefined;

  try {
    const store = app.get(LocalValidationStore);
    const orchestrator = app.get(LocalValidationOrchestratorService);

    logger.log([
      'Starting real local validation smoke',
      `paperVersion=${options.paperVersion}`,
      `scenarioPackId=${options.scenarioPackId}`,
      `requestedBotCount=${options.requestedBotCount}`,
      `scenarioProfile=${process.env['LOCAL_VALIDATION_SCENARIO_PROFILE']}`,
      `workspacePath=${workspacePath}`,
      `dbPath=${dbPath}`,
    ].join(' '));

    const draft = await store.createDraftRun({
      name: options.runName,
      mode: 'init-paper',
      paperVersion: options.paperVersion,
      scenarioPackId: options.scenarioPackId,
      requestedBotCount: options.requestedBotCount,
      requestedBy: 'local-validation-smoke',
      keepServerRunning: options.keepServerRunning,
      keepWorkspace: options.keepWorkspace,
      workspacePath,
    });

    const readyRun = await orchestrator.startRun(draft);
    serverId = readyRun.serverId;
    logger.log(`Run ${draft.id} started; current status=${readyRun.status} serverId=${readyRun.serverId ?? 'n/a'}`);

    const finalRun = await waitForTerminalRun(store, draft.id, options.timeoutMs, options.pollIntervalMs);
    serverId = finalRun.serverId ?? serverId;
    const [stages, assertions, evidence] = await Promise.all([
      store.listStages(draft.id),
      store.listAssertions(draft.id),
      store.listEvidence(draft.id),
    ]);

    const verdict = validateLocalValidationSmokeOutcome({
      run: finalRun,
      stages,
      assertions,
      evidence,
    });

    logger.log(`Smoke summary: ${JSON.stringify(verdict.summary, null, 2)}`);

    if (!verdict.ok) {
      throw new Error(verdict.errors.join('; '));
    }

    logger.log(`Local validation smoke passed for run ${draft.id}`);
  } finally {
    await cleanupArtifacts({
      lifecycle: app.get(ServerLifecycleEngine),
      configService: app.get(ServerConfigService),
      serverId,
      workspacePath,
      dbPath,
      keepServerRunning: options.keepServerRunning,
      keepWorkspace: options.keepWorkspace,
      keepDatabase: options.keepDatabase,
    });
    await app.close();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    logger.error(message);
    process.exit(1);
  });
