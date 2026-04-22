import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '../../storage/schema.js';
import { LocalValidationStore } from '../local-validation.store.js';

describe('LocalValidationStore', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;
  let store: LocalValidationStore;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    db = drizzle(sqlite, { schema });
    sqlite.exec(`
      CREATE TABLE local_validation_runs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mode TEXT NOT NULL,
        server_id TEXT,
        status TEXT NOT NULL,
        paper_version TEXT,
        scenario_pack_id TEXT NOT NULL,
        requested_bot_count INTEGER NOT NULL,
        effective_bot_count INTEGER NOT NULL DEFAULT 0,
        requested_by TEXT NOT NULL,
        failure_code TEXT,
        failure_message TEXT,
        keep_server_running INTEGER NOT NULL DEFAULT 0,
        keep_workspace INTEGER NOT NULL DEFAULT 0,
        workspace_path TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX idx_local_validation_run_id ON local_validation_runs(id);

      CREATE TABLE local_validation_stages (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        stage_key TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        timeout_ms INTEGER NOT NULL,
        bot_group_snapshot_json TEXT NOT NULL DEFAULT '[]',
        assertion_summary_json TEXT NOT NULL DEFAULT '{"total":0,"passed":0,"failed":0}'
      );
      CREATE UNIQUE INDEX idx_local_validation_stage_run_key ON local_validation_stages(run_id, stage_key);

      CREATE TABLE local_validation_assertions (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        stage_id TEXT NOT NULL,
        assertion_key TEXT NOT NULL,
        title TEXT NOT NULL,
        required INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL,
        threshold REAL NOT NULL,
        actual REAL NOT NULL,
        message TEXT NOT NULL,
        evidence_refs_json TEXT NOT NULL DEFAULT '[]'
      );
      CREATE UNIQUE INDEX idx_local_validation_assertion_stage_key ON local_validation_assertions(stage_id, assertion_key);

      CREATE TABLE local_validation_evidence (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        evidence_kind TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        summary TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}'
      );
    `);
    store = new LocalValidationStore(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('creates a draft run with the Task 1 CREATED status and exact run fields', async () => {
    const run = await store.createDraftRun({
      name: 'Paper startup smoke',
      mode: 'init-paper',
      scenarioPackId: 'combat-pack-v1',
      requestedBotCount: 8,
      requestedBy: 'qa',
      keepServerRunning: false,
      keepWorkspace: true,
      workspacePath: '/tmp/jianagent/lvr_001',
      paperVersion: '1.21.1',
    });

    expect(run.status).toBe('CREATED');
    expect(run.effectiveBotCount).toBe(0);
    expect(run.startedAt).toBeUndefined();
    expect(run.finishedAt).toBeUndefined();

    const [rawRun] = db.select().from(schema.localValidationRuns).where(eq(schema.localValidationRuns.id, run.id)).all();
    expect(rawRun).toMatchObject({
      name: 'Paper startup smoke',
      mode: 'init-paper',
      status: 'CREATED',
      paperVersion: '1.21.1',
      scenarioPackId: 'combat-pack-v1',
      requestedBotCount: 8,
      effectiveBotCount: 0,
      requestedBy: 'qa',
      failureCode: null,
      failureMessage: null,
      keepServerRunning: false,
      keepWorkspace: true,
      workspacePath: '/tmp/jianagent/lvr_001',
    });
  });

  it('attaches a server and updates run status through the Task 1 workflow', async () => {
    const run = await store.createDraftRun({
      name: 'Import existing server',
      mode: 'import-existing',
      scenarioPackId: 'combat-pack-v1',
      requestedBotCount: 4,
      requestedBy: 'ops',
      keepServerRunning: true,
      keepWorkspace: false,
      workspacePath: '/tmp/jianagent/lvr_002',
    });

    const attached = await store.attachServer(run.id, 'server-1');
    expect(attached.serverId).toBe('server-1');
    expect(attached.status).toBe('PROVISIONING');
    expect(attached.startedAt).toBeDefined();

    const failed = await store.updateRunStatus(run.id, 'FAILED_STARTUP', {
      failureCode: 'paper_boot_failed',
      failureMessage: 'Paper failed to boot',
    });
    expect(failed.status).toBe('FAILED_STARTUP');
    expect(failed.failureCode).toBe('paper_boot_failed');
    expect(failed.failureMessage).toBe('Paper failed to boot');
    expect(failed.finishedAt).toBeDefined();

    const runs = await store.listRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]!.id).toBe(run.id);
  });

  it('upserts stages, replaces assertions, and appends evidence using Task 1 JSON columns', async () => {
    const run = await store.createDraftRun({
      name: 'Combat validation',
      mode: 'init-paper',
      scenarioPackId: 'combat-pack-v1',
      requestedBotCount: 6,
      requestedBy: 'qa',
      keepServerRunning: false,
      keepWorkspace: false,
      workspacePath: '/tmp/jianagent/lvr_003',
    });

    const stage = await store.upsertStage({
      runId: run.id,
      stageKey: 'precheck',
      title: 'Precheck the workspace',
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
    });

    expect(stage.botGroupSnapshot).toEqual([
      {
        name: 'alpha',
        botNames: ['bot-a', 'bot-b'],
      },
    ]);
    expect(stage.assertionSummary).toEqual({
      total: 2,
      passed: 1,
      failed: 1,
    });

    const updatedStage = await store.upsertStage({
      runId: run.id,
      stageKey: 'precheck',
      title: 'Precheck the workspace',
      status: 'passed',
      timeoutMs: 90000,
      botGroupSnapshot: [],
      assertionSummary: {
        total: 3,
        passed: 3,
        failed: 0,
      },
    });
    expect(updatedStage.id).toBe(stage.id);
    expect(updatedStage.status).toBe('passed');

    const firstAssertions = await store.replaceAssertions(run.id, [
      {
        stageId: stage.id,
        key: 'server-ready',
        title: 'Server reports ready',
        required: true,
        status: 'passed',
        threshold: 0.75,
        actual: 1,
        message: 'Server reached the ready state',
        evidenceRefs: ['lve_001'],
      },
      {
        stageId: stage.id,
        key: 'bot-joined',
        title: 'Bot joins the server',
        required: false,
        status: 'failed',
        threshold: 1,
        actual: 0,
        message: 'Bot never connected',
        evidenceRefs: [],
      },
    ]);
    expect(firstAssertions).toHaveLength(2);
    expect(firstAssertions[0]!.evidenceRefs).toEqual(['lve_001']);

    const replacedAssertions = await store.replaceAssertions(run.id, [
      {
        stageId: stage.id,
        key: 'server-ready',
        title: 'Server reports ready',
        required: true,
        status: 'passed',
        threshold: 0.75,
        actual: 1,
        message: 'Server reached the ready state',
        evidenceRefs: ['lve_002'],
      },
    ]);
    expect(replacedAssertions).toHaveLength(1);

    const evidence = await store.appendEvidence({
      runId: run.id,
      evidenceKind: 'server-log',
      timestamp: '2026-04-19T10:00:07.000Z',
      summary: 'Paper logged the ready banner',
      payload: {
        line: '[Server thread/INFO]: Done (3.1s)!',
      },
    });
    expect(evidence.kind).toBe('server-log');
    expect(evidence.payload.line).toBe('[Server thread/INFO]: Done (3.1s)!');

    const [rawStage] = db.select().from(schema.localValidationStages).where(eq(schema.localValidationStages.id, stage.id)).all();
    expect(rawStage).toMatchObject({
      runId: run.id,
      stageKey: 'precheck',
      title: 'Precheck the workspace',
      status: 'passed',
      timeoutMs: 90000,
    });
    expect(JSON.parse(rawStage.botGroupSnapshotJson)).toEqual([]);
    expect(JSON.parse(rawStage.assertionSummaryJson)).toEqual({
      total: 3,
      passed: 3,
      failed: 0,
    });

    const assertionRows = db.select().from(schema.localValidationAssertions).where(eq(schema.localValidationAssertions.runId, run.id)).all();
    expect(assertionRows).toHaveLength(1);
    expect(JSON.parse(assertionRows[0]!.evidenceRefsJson)).toEqual(['lve_002']);

    const [rawEvidence] = db.select().from(schema.localValidationEvidence).where(eq(schema.localValidationEvidence.runId, run.id)).all();
    expect(rawEvidence).toMatchObject({
      runId: run.id,
      evidenceKind: 'server-log',
      timestamp: '2026-04-19T10:00:07.000Z',
      summary: 'Paper logged the ready banner',
    });
    expect(JSON.parse(rawEvidence.payloadJson)).toEqual({
      line: '[Server thread/INFO]: Done (3.1s)!',
    });
  });

  it('lists stages, assertions, and evidence for a run', async () => {
    const run = await store.createDraftRun({
      name: 'Artifact listing',
      mode: 'init-paper',
      scenarioPackId: 'combat-pack-v1',
      requestedBotCount: 3,
      requestedBy: 'qa',
      keepServerRunning: false,
      keepWorkspace: false,
      workspacePath: '/tmp/jianagent/lvr_003b',
    });

    const stage = await store.upsertStage({
      runId: run.id,
      stageKey: 'movement-and-chat',
      title: 'Movement and Chat',
      status: 'passed',
      timeoutMs: 90000,
    });

    await store.replaceAssertions(run.id, [
      {
        stageId: stage.id,
        key: 'movement-chat-ratio',
        title: 'Movement and Chat ratio',
        required: true,
        status: 'passed',
        threshold: 0.9,
        actual: 1,
        message: 'All bots moved and chatted',
        evidenceRefs: ['lve_1'],
      },
    ]);

    await store.appendEvidence({
      runId: run.id,
      evidenceKind: 'bot-event',
      timestamp: '2026-04-19T10:00:08.000Z',
      summary: 'Bot movement confirmed',
      payload: { botName: 'bot-a' },
    });

    const stages = await store.listStages(run.id);
    const assertions = await store.listAssertions(run.id);
    const evidence = await store.listEvidence(run.id);

    expect(stages).toHaveLength(1);
    expect(stages[0]?.stageKey).toBe('movement-and-chat');
    expect(assertions).toHaveLength(1);
    expect(assertions[0]?.key).toBe('movement-chat-ratio');
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.kind).toBe('bot-event');
  });

  it('replaces assertions per stage without deleting assertions from earlier stages', async () => {
    const run = await store.createDraftRun({
      name: 'Stage scoped assertions',
      mode: 'init-paper',
      scenarioPackId: 'combat-pack-v1',
      requestedBotCount: 2,
      requestedBy: 'qa',
      keepServerRunning: false,
      keepWorkspace: false,
      workspacePath: '/tmp/jianagent/lvr_stage_assertions',
    });

    const spawnStage = await store.upsertStage({
      runId: run.id,
      stageKey: 'spawn-and-stabilize',
      title: 'Spawn and Stabilize',
      status: 'passed',
      timeoutMs: 15000,
    });
    const movementStage = await store.upsertStage({
      runId: run.id,
      stageKey: 'movement-and-chat',
      title: 'Movement and Chat',
      status: 'passed',
      timeoutMs: 20000,
    });

    await store.replaceAssertions(run.id, [
      {
        stageId: spawnStage.id,
        key: 'spawn-stability-ratio',
        title: 'Spawn stability ratio',
        required: true,
        status: 'passed',
        threshold: 1,
        actual: 1,
        message: 'All bots spawned',
        evidenceRefs: [],
      },
    ]);
    await store.replaceAssertions(run.id, [
      {
        stageId: movementStage.id,
        key: 'movement-chat-ratio',
        title: 'Movement and chat ratio',
        required: true,
        status: 'passed',
        threshold: 0.9,
        actual: 1,
        message: 'All bots moved and chatted',
        evidenceRefs: [],
      },
    ]);

    const assertions = await store.listAssertions(run.id);
    expect(assertions).toHaveLength(2);
    expect(new Set(assertions.map((item) => item.key))).toEqual(new Set([
      'spawn-stability-ratio',
      'movement-chat-ratio',
    ]));
  });

  it('rolls back assertion replacement when one insert fails', async () => {
    const run = await store.createDraftRun({
      name: 'Atomic replacement',
      mode: 'init-paper',
      scenarioPackId: 'combat-pack-v1',
      requestedBotCount: 6,
      requestedBy: 'qa',
      keepServerRunning: false,
      keepWorkspace: false,
      workspacePath: '/tmp/jianagent/lvr_004',
    });

    const stage = await store.upsertStage({
      runId: run.id,
      stageKey: 'precheck',
      title: 'Precheck the workspace',
      status: 'running',
      timeoutMs: 120000,
    });

    await store.replaceAssertions(run.id, [
      {
        stageId: stage.id,
        key: 'server-ready',
        title: 'Server reports ready',
        required: true,
        status: 'passed',
        threshold: 0.75,
        actual: 1,
        message: 'Server reached the ready state',
        evidenceRefs: [],
      },
      {
        stageId: stage.id,
        key: 'bot-joined',
        title: 'Bot joins the server',
        required: false,
        status: 'passed',
        threshold: 1,
        actual: 1,
        message: 'Bot connected successfully',
        evidenceRefs: [],
      },
    ]);

    await expect(
      store.replaceAssertions(run.id, [
        {
          stageId: stage.id,
          key: 'duplicate-key',
          title: 'Duplicate key one',
          required: true,
          status: 'passed',
          threshold: 1,
          actual: 1,
          message: 'First duplicate row',
          evidenceRefs: [],
        },
        {
          stageId: stage.id,
          key: 'duplicate-key',
          title: 'Duplicate key two',
          required: true,
          status: 'failed',
          threshold: 1,
          actual: 0,
          message: 'Second duplicate row',
          evidenceRefs: [],
        },
      ]),
    ).rejects.toThrow();

    const assertionRows = db.select().from(schema.localValidationAssertions).where(eq(schema.localValidationAssertions.runId, run.id)).all();
    expect(assertionRows).toHaveLength(2);
    expect(assertionRows.map((row) => row.assertionKey).sort()).toEqual(['bot-joined', 'server-ready']);
  });

  it('rejects orphaned stage and evidence writes', async () => {
    const run = await store.createDraftRun({
      name: 'Integrity guards',
      mode: 'import-existing',
      scenarioPackId: 'combat-pack-v1',
      requestedBotCount: 4,
      requestedBy: 'ops',
      keepServerRunning: true,
      keepWorkspace: false,
      workspacePath: '/tmp/jianagent/lvr_005',
    });

    await expect(
      store.upsertStage({
        runId: 'missing-run',
        stageKey: 'precheck',
        title: 'Precheck the workspace',
        status: 'running',
        timeoutMs: 120000,
      }),
    ).rejects.toThrow('Local validation run missing-run not found');

    const stage = await store.upsertStage({
      runId: run.id,
      stageKey: 'precheck',
      title: 'Precheck the workspace',
      status: 'running',
      timeoutMs: 120000,
    });

    await expect(
      store.appendEvidence({
        runId: 'missing-run',
        stageId: stage.id,
        evidenceKind: 'server-log',
        summary: 'Orphaned run should fail',
        payload: {},
      }),
    ).rejects.toThrow('Local validation run missing-run not found');

    await expect(
      store.appendEvidence({
        runId: run.id,
        stageId: 'missing-stage',
        evidenceKind: 'server-log',
        summary: 'Orphaned stage should fail',
        payload: {},
      }),
    ).rejects.toThrow('Local validation stage missing-stage not found');
  });

  it('throws when a required run is missing', async () => {
    await expect(store.requireRun('missing')).rejects.toThrow('Local validation run missing not found');
  });
});
