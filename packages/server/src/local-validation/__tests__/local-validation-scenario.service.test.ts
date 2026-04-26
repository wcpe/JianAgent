import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalValidationRunDto } from '@jian-agent/shared-domain';
import { ScenarioAssertionService } from '../scenario-assertion.service.js';
import { LocalValidationScenarioService } from '../local-validation-scenario.service.js';
import { PvpArenaService } from '../pvp-arena.service.js';
import { ScenarioEvidenceService } from '../scenario-evidence.service.js';
import { resolveBuildTarget } from '../build-target.utils.js';

describe('LocalValidationScenarioService', () => {
  let service: LocalValidationScenarioService;
  let pvpArena: PvpArenaService;
  let scenarioEvidence: ScenarioEvidenceService;
  const originalScenarioProfile = process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'];

  function createRun(overrides: Partial<LocalValidationRunDto> = {}): LocalValidationRunDto {
    return {
      id: 'lvr_1',
      name: 'combat smoke',
      mode: 'init-paper',
      status: 'READY',
      serverId: 'srv_1',
      paperVersion: '1.21.1',
      scenarioPackId: 'combat-pack-v1',
      requestedBotCount: 4,
      effectiveBotCount: 0,
      requestedBy: 'admin',
      keepServerRunning: false,
      keepWorkspace: false,
      workspacePath: '/tmp/lvr_1',
      ...overrides,
    };
  }

  const store = {
    updateRunStatus: vi.fn(),
    upsertStage: vi.fn(),
    replaceAssertions: vi.fn(),
  };

  const scenarioCatalog = {
    getScenarioPackDefinition: vi.fn(),
  };

  const botOrchestrator = {
    createBotBatch: vi.fn(),
    setBehavior: vi.fn(),
    stopBatch: vi.fn(),
    enrichedBots: vi.fn(),
    getBotDetail: vi.fn(),
    forceRespawn: vi.fn(),
  };

  const botState = {
    allBots: vi.fn(),
  };

  const botRealtime = {
    getRecentBotEvents: vi.fn(),
    getRecentChatMessages: vi.fn(),
  };

  const validationEvidence = {
    appendOperationEvidence: vi.fn(),
    appendBotEventEvidence: vi.fn(),
    appendFailureEvidence: vi.fn(),
  };

  const processManager = {
    writeStdin: vi.fn(),
  };

  const validationReport = {
    buildReport: vi.fn(),
  };

  const eventBus = {
    emit: vi.fn(),
  };

  afterEach(() => {
    if (originalScenarioProfile === undefined) {
      delete process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'];
      return;
    }
    process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'] = originalScenarioProfile;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    scenarioCatalog.getScenarioPackDefinition.mockReturnValue({
      id: 'combat-pack-v1',
      name: '综合对抗验收包',
      description: 'test',
      stages: [
        { key: 'spawn-and-stabilize', title: 'Spawn and Stabilize', assertionKey: 'spawn-stability-ratio', behaviorTemplate: 'idle', durationSec: 0, threshold: 1 },
        { key: 'movement-and-chat', title: 'Movement and Chat', assertionKey: 'movement-chat-ratio', behaviorTemplate: 'patrol', durationSec: 0, threshold: 0.5 },
        { key: 'gather-and-place', title: 'Gather and Place', assertionKey: 'gather-place-ratio', behaviorTemplate: 'gather', durationSec: 0, threshold: 0.5 },
        { key: 'pvp-damage-death-respawn', title: 'PvP Damage, Death, and Respawn', assertionKey: 'pvp-respawn-ratio', behaviorTemplate: 'attack', durationSec: 0, threshold: 0.25 },
      ],
    });

    botOrchestrator.createBotBatch.mockResolvedValue({
      batchId: 'batch-1',
      createdNames: ['bot-1', 'bot-2', 'bot-3', 'bot-4'],
      serverId: 'srv_1',
      behavior: 'idle',
    });
    botOrchestrator.setBehavior.mockReturnValue(true);
    botOrchestrator.getBotDetail
      .mockResolvedValueOnce({ inventory: [], nearbyEntities: [], terrain: [{ x: 2, y: 64, z: 1, name: 'dirt' }] })
      .mockResolvedValueOnce({ inventory: [], nearbyEntities: [], terrain: [{ x: 12, y: 64, z: 1, name: 'dirt' }] })
      .mockResolvedValueOnce({ inventory: [], nearbyEntities: [], terrain: [{ x: 22, y: 64, z: 1, name: 'grass_block' }] })
      .mockResolvedValueOnce({ inventory: [], nearbyEntities: [], terrain: [{ x: 32, y: 64, z: 1, name: 'grass_block' }] })
      .mockResolvedValueOnce({ inventory: [{ name: 'dirt', count: 4 }], nearbyEntities: [], terrain: [{ x: 2, y: 63, z: 1, name: 'stone' }] })
      .mockResolvedValueOnce({ inventory: [{ name: 'dirt', count: 4 }], nearbyEntities: [], terrain: [{ x: 12, y: 63, z: 1, name: 'stone' }] })
      .mockResolvedValueOnce({ inventory: [], nearbyEntities: [], terrain: [{ x: 22, y: 64, z: 1, name: 'grass_block' }] })
      .mockResolvedValueOnce({ inventory: [], nearbyEntities: [], terrain: [{ x: 32, y: 64, z: 1, name: 'grass_block' }] })
      .mockResolvedValueOnce({ inventory: [], nearbyEntities: [], terrain: [{ x: 2, y: 64, z: 1, name: 'dirt' }] })
      .mockResolvedValueOnce({ inventory: [], nearbyEntities: [], terrain: [{ x: 12, y: 64, z: 1, name: 'dirt' }] });

    const now = Date.now();
    const createSnapshots = (
      behavior: string,
      positions: readonly [number, number, number, number],
      deathCounts: readonly [number, number, number, number] = [0, 0, 0, 0],
    ) => ([
      { name: 'bot-1', state: 'SPAWNED', currentBehavior: behavior, workerPid: 1, x: positions[0], y: 64, z: 0, health: 20, food: 20, latencyMs: 0, world: 'world', isDead: false, deathCount: deathCounts[0], connectedAt: '', lastError: null, lastHeartbeat: now },
      { name: 'bot-2', state: 'SPAWNED', currentBehavior: behavior, workerPid: 1, x: positions[1], y: 64, z: 0, health: 20, food: 20, latencyMs: 0, world: 'world', isDead: false, deathCount: deathCounts[1], connectedAt: '', lastError: null, lastHeartbeat: now },
      { name: 'bot-3', state: 'SPAWNED', currentBehavior: behavior, workerPid: 1, x: positions[2], y: 64, z: 0, health: 20, food: 20, latencyMs: 0, world: 'world', isDead: false, deathCount: deathCounts[2], connectedAt: '', lastError: null, lastHeartbeat: now },
      { name: 'bot-4', state: 'SPAWNED', currentBehavior: behavior, workerPid: 1, x: positions[3], y: 64, z: 0, health: 20, food: 20, latencyMs: 0, world: 'world', isDead: false, deathCount: deathCounts[3], connectedAt: '', lastError: null, lastHeartbeat: now },
    ]);
    const createGatherSnapshots = () => ([
      { name: 'bot-1', state: 'SPAWNED', currentBehavior: 'gather', workerPid: 1, x: 1, y: 64, z: 1, health: 20, food: 20, latencyMs: 0, world: 'world', isDead: false, deathCount: 0, connectedAt: '', lastError: null, lastHeartbeat: now },
      { name: 'bot-2', state: 'SPAWNED', currentBehavior: 'gather', workerPid: 1, x: 11, y: 64, z: 1, health: 20, food: 20, latencyMs: 0, world: 'world', isDead: false, deathCount: 0, connectedAt: '', lastError: null, lastHeartbeat: now },
      { name: 'bot-3', state: 'SPAWNED', currentBehavior: 'gather', workerPid: 1, x: 21, y: 64, z: 1, health: 20, food: 20, latencyMs: 0, world: 'world', isDead: false, deathCount: 0, connectedAt: '', lastError: null, lastHeartbeat: now },
      { name: 'bot-4', state: 'SPAWNED', currentBehavior: 'gather', workerPid: 1, x: 31, y: 64, z: 1, health: 20, food: 20, latencyMs: 0, world: 'world', isDead: false, deathCount: 0, connectedAt: '', lastError: null, lastHeartbeat: now },
    ]);

    const snapshotSequence = [
      createSnapshots('idle', [0, 10, 20, 30]),
      createSnapshots('patrol', [0, 10, 20, 30]),
      createSnapshots('patrol', [0, 10, 20, 30]),
      createSnapshots('patrol', [0, 10, 20, 30]),
      createSnapshots('patrol', [4, 10, 24, 30]),
      createSnapshots('patrol', [4, 10, 24, 30]),
      createGatherSnapshots(),
      createSnapshots('attack', [1, 11, 21, 31]),
      createSnapshots('attack', [1, 11, 21, 31], [1, 0, 1, 0]),
    ];
    let snapshotIndex = 0;
    botState.allBots.mockImplementation(() => snapshotSequence[Math.min(snapshotIndex++, snapshotSequence.length - 1)]);

    botRealtime.getRecentChatMessages.mockImplementation(() => [
      { botName: 'bot-2', message: 'hi', timestamp: Date.now(), serverId: 'srv_1', batchId: 'batch-1', validationRunId: 'lvr_1' },
      { botName: 'bot-4', message: 'hello', timestamp: Date.now(), serverId: 'srv_1', batchId: 'batch-1', validationRunId: 'lvr_1' },
    ]);
    botRealtime.getRecentBotEvents.mockImplementation(() => [
      { botName: 'bot-1', event: 'RESPAWNED', message: 'respawned', timestamp: Date.now(), serverId: 'srv_1', batchId: 'batch-1', validationRunId: 'lvr_1' },
      { botName: 'bot-3', event: 'RESPAWNED', message: 'respawned', timestamp: Date.now(), serverId: 'srv_1', batchId: 'batch-1', validationRunId: 'lvr_1' },
    ]);

    store.updateRunStatus.mockImplementation(async (id: string, status: string, patch?: Record<string, unknown>) => ({
      ...createRun({ id, status: status as LocalValidationRunDto['status'] }),
      ...patch,
      status,
    }));
    store.upsertStage.mockImplementation(async (input: { stageKey: string; status: string; title: string }) => ({
      id: `stage-${input.stageKey}`,
      runId: 'lvr_1',
      stageKey: input.stageKey,
      title: input.title,
      status: input.status,
      timeoutMs: 0,
      botGroupSnapshot: [],
      assertionSummary: { total: 1, passed: input.status === 'passed' ? 1 : 0, failed: input.status === 'failed' ? 1 : 0 },
    }));
    store.replaceAssertions.mockImplementation(async (_runId: string, assertions: readonly { key: string; status: string }[]) =>
      assertions.map((assertion, index) => ({
        id: `assert-${index}`,
        runId: 'lvr_1',
        stageId: 'stage',
        key: assertion.key,
        title: assertion.key,
        required: true,
        status: assertion.status as 'passed' | 'failed',
        threshold: 1,
        actual: 1,
        message: assertion.key,
        evidenceRefs: [],
      })),
    );
    validationReport.buildReport.mockReturnValue({
      runId: 'lvr_1',
      status: 'PASSED',
      generatedAt: '2026-04-20T00:00:00.000Z',
      sections: [],
    });

    pvpArena = new PvpArenaService(
      botOrchestrator as never,
      botState as never,
      botRealtime as never,
      processManager as never,
    );
    scenarioEvidence = new ScenarioEvidenceService(
      botRealtime as never,
    );

    service = new LocalValidationScenarioService(
      store as never,
      scenarioCatalog as never,
      new ScenarioAssertionService(),
      botOrchestrator as never,
      botState as never,
      validationEvidence as never,
      validationReport as never,
      eventBus as never,
      pvpArena,
      scenarioEvidence,
    );
  });

  it('creates a validation batch, executes all stages, and marks the run as PASSED', async () => {
    const result = await service.executeScenario(createRun());

    expect(botOrchestrator.createBotBatch).toHaveBeenCalledWith(expect.objectContaining({
      serverId: 'srv_1',
      count: 4,
      validationRunId: 'lvr_1',
    }));
    expect(store.updateRunStatus).toHaveBeenCalledWith(
      'lvr_1',
      'RUNNING_SCENARIO',
      expect.objectContaining({
        effectiveBotCount: 4,
      }),
    );
    expect(store.upsertStage).toHaveBeenCalledTimes(8);
    expect(store.replaceAssertions).toHaveBeenCalledTimes(4);
    expect(botOrchestrator.stopBatch).toHaveBeenCalledWith('batch-1');
    expect(validationEvidence.appendOperationEvidence).toHaveBeenCalledWith(
      'lvr_1',
      '场景报告',
      expect.objectContaining({
        report: expect.objectContaining({ runId: 'lvr_1', status: 'PASSED' }),
      }),
    );
    expect(result).toEqual(expect.objectContaining({ status: 'PASSED' }));
  });

  it('uses the stage behavior template for movement bots and a safer chat cadence', async () => {
    process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'] = 'smoke';
    scenarioCatalog.getScenarioPackDefinition.mockReturnValueOnce({
      id: 'combat-pack-v1',
      name: '综合对抗验收包',
      description: 'test',
      stages: [
        { key: 'spawn-and-stabilize', title: 'Spawn and Stabilize', assertionKey: 'spawn-stability-ratio', behaviorTemplate: 'idle', durationSec: 0, threshold: 1 },
        { key: 'movement-and-chat', title: 'Movement and Chat', assertionKey: 'movement-chat-ratio', behaviorTemplate: 'move-random', durationSec: 0, threshold: 0.5 },
      ],
    });
    botOrchestrator.createBotBatch.mockResolvedValueOnce({
      batchId: 'batch-1',
      createdNames: ['bot-1', 'bot-2'],
      serverId: 'srv_1',
      behavior: 'idle',
    });

    await service.executeScenario(createRun({ requestedBotCount: 2 }));

    expect(botOrchestrator.setBehavior).toHaveBeenCalledWith(
      'bot-1',
      'move-random',
      expect.objectContaining({
        navigationProfile: 'pathfinder-strict',
        scenarioProfile: 'smoke',
        determinismLevel: 'strict',
      }),
    );
    expect(botOrchestrator.setBehavior).toHaveBeenCalledWith('bot-2', 'chat', expect.objectContaining({
      intervalMs: 2500,
    }));
  });

  it('prepares a smoke PvP arena and force-respawns bots that enter the stage dirty', async () => {
    process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'] = 'smoke';
    scenarioCatalog.getScenarioPackDefinition.mockReturnValueOnce({
      id: 'combat-pack-v1',
      name: '综合对抗验收包',
      description: 'test',
      stages: [
        { key: 'pvp-damage-death-respawn', title: 'PvP Damage, Death, and Respawn', assertionKey: 'pvp-respawn-ratio', behaviorTemplate: 'attack', durationSec: 0, threshold: 0.5 },
      ],
    });
    botOrchestrator.createBotBatch.mockResolvedValueOnce({
      batchId: 'batch-1',
      createdNames: ['bot-1', 'bot-2'],
      serverId: 'srv_1',
      behavior: 'idle',
    });

    let snapshotCall = 0;
    botState.allBots.mockImplementation(() => {
      snapshotCall += 1;
      if (snapshotCall === 1) {
        return [
          { name: 'bot-1', state: 'DEAD', currentBehavior: 'gather', workerPid: 1, x: 0, y: 64, z: 0, health: 0, food: 20, latencyMs: 0, world: 'world', isDead: true, deathCount: 1, connectedAt: '', lastError: null, lastHeartbeat: Date.now() },
          { name: 'bot-2', state: 'SPAWNED', currentBehavior: 'gather', workerPid: 1, x: 1, y: 64, z: 0, health: 20, food: 20, latencyMs: 0, world: 'world', isDead: false, deathCount: 0, connectedAt: '', lastError: null, lastHeartbeat: Date.now() },
        ];
      }

      return [
        { name: 'bot-1', state: 'SPAWNED', currentBehavior: 'attack', workerPid: 1, x: -2, y: 81, z: 0, health: 20, food: 20, latencyMs: 0, world: 'world', isDead: false, deathCount: 1, connectedAt: '', lastError: null, lastHeartbeat: Date.now() },
        { name: 'bot-2', state: 'SPAWNED', currentBehavior: 'attack', workerPid: 1, x: 2, y: 81, z: 0, health: 20, food: 20, latencyMs: 0, world: 'world', isDead: false, deathCount: 1, connectedAt: '', lastError: null, lastHeartbeat: Date.now() },
      ];
    });
    botRealtime.getRecentBotEvents.mockReturnValue([
      { botName: 'bot-1', event: 'RESPAWNED', message: 'respawned', timestamp: Date.now(), serverId: 'srv_1', batchId: 'batch-1', validationRunId: 'lvr_1' },
    ]);
    (service as any).sleep = vi.fn().mockResolvedValue(undefined);
    (pvpArena as any).sleep = vi.fn().mockResolvedValue(undefined);

    await service.executeScenario(createRun({ requestedBotCount: 2 }));

    expect(botOrchestrator.forceRespawn).toHaveBeenCalledWith('bot-1');
    expect(processManager.writeStdin).toHaveBeenCalledWith('srv_1', expect.stringContaining('gamerule doImmediateRespawn true'));
    expect(processManager.writeStdin).toHaveBeenCalledWith('srv_1', expect.stringContaining('tp bot-1 -2 81 0'));
    expect(processManager.writeStdin).toHaveBeenCalledWith('srv_1', expect.stringContaining('tp bot-2 2 81 0'));
  });

  it('forces smoke PvP damage when no deaths are observed after the warmup window', async () => {
    process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'] = 'smoke';
    scenarioCatalog.getScenarioPackDefinition.mockReturnValueOnce({
      id: 'combat-pack-v1',
      name: '综合对抗验收包',
      description: 'test',
      stages: [
        { key: 'pvp-damage-death-respawn', title: 'PvP Damage, Death, and Respawn', assertionKey: 'pvp-respawn-ratio', behaviorTemplate: 'attack', durationSec: 20, threshold: 0.5 },
      ],
    });
    botOrchestrator.createBotBatch.mockResolvedValueOnce({
      batchId: 'batch-1',
      createdNames: ['bot-1', 'bot-2'],
      serverId: 'srv_1',
      behavior: 'idle',
    });

    botState.allBots.mockReturnValue([
      { name: 'bot-1', state: 'SPAWNED', currentBehavior: 'attack', workerPid: 1, x: -2, y: 81, z: 0, health: 20, food: 20, latencyMs: 0, world: 'world', isDead: false, deathCount: 0, connectedAt: '', lastError: null, lastHeartbeat: Date.now() },
      { name: 'bot-2', state: 'SPAWNED', currentBehavior: 'attack', workerPid: 1, x: 2, y: 81, z: 0, health: 20, food: 20, latencyMs: 0, world: 'world', isDead: false, deathCount: 0, connectedAt: '', lastError: null, lastHeartbeat: Date.now() },
    ]);
    botRealtime.getRecentBotEvents.mockReturnValue([]);
    (service as any).sleep = vi.fn().mockResolvedValue(undefined);
    (pvpArena as any).sleep = vi.fn().mockResolvedValue(undefined);

    await service.executeScenario(createRun({ requestedBotCount: 2 }));

    expect(processManager.writeStdin).toHaveBeenCalledWith(
      'srv_1',
      expect.stringContaining('damage bot-2 40 minecraft:player_attack by bot-1'),
    );
  });

  it('counts a bot as respawned when death count increases and the bot is alive again even without a respawn event', () => {
    botRealtime.getRecentBotEvents.mockReturnValue([
      { botName: 'bot-2', event: 'DIED', message: 'bot-2 died', timestamp: Date.now(), serverId: 'srv_1', batchId: 'batch-1', validationRunId: 'lvr_1' },
    ]);
    botState.allBots.mockReturnValue([
      { name: 'bot-1', state: 'SPAWNED', currentBehavior: 'attack', workerPid: 1, x: -2, y: 81, z: 0, health: 20, food: 20, latencyMs: 0, world: 'world', isDead: false, deathCount: 0, connectedAt: '', lastError: null, lastHeartbeat: Date.now() },
      { name: 'bot-2', state: 'SPAWNED', currentBehavior: 'attack', workerPid: 1, x: 2, y: 81, z: 0, health: 20, food: 20, latencyMs: 0, world: 'world', isDead: false, deathCount: 1, connectedAt: '', lastError: null, lastHeartbeat: Date.now() },
    ]);

    const observation = pvpArena.collectPvpStageObservation(
      createRun({ requestedBotCount: 2 }),
      { batchId: 'batch-1', botNames: ['bot-1', 'bot-2'] },
      new Map([
        ['bot-1', 0],
        ['bot-2', 0],
      ]),
      Date.now() - 1000,
    );

    expect([...observation.deathCountDeltaBots]).toEqual(['bot-2']);
    expect([...observation.respawnedBots]).toEqual(['bot-2']);
  });

  it('prefers refilling the excavated column on the original terrain before falling back to a nearby surface', () => {
    const target = resolveBuildTarget(
      { x: 1.2, y: 64, z: 1.1 },
      [
        { x: 2, y: 64, z: 1, name: 'dirt' },
        { x: 4, y: 63, z: 1, name: 'grass_block' },
      ],
      [
        { x: 2, y: 63, z: 1, name: 'stone' },
        { x: 4, y: 63, z: 1, name: 'grass_block' },
      ],
      'dirt',
    );

    expect(target).toEqual({
      x: 2,
      y: 64,
      z: 1,
      blockName: 'dirt',
    });
  });

  it('summarizes build failure telemetry into gather evidence', async () => {
    botRealtime.getRecentBotEvents.mockReturnValue([
      {
        botName: 'bot-1',
        event: 'BUILD_FAILURE',
        message: 'occupied target column',
        timestamp: Date.now(),
        serverId: 'srv_1',
        batchId: 'batch-1',
        validationRunId: 'lvr_1',
        metadata: {
          reason: 'occupied-target',
          target: { x: 2, y: 64, z: 1, blockName: 'dirt' },
          standingPosition: { x: 4, y: 64, z: 1 },
        },
      },
      {
        botName: 'bot-2',
        event: 'BUILD_FAILURE',
        message: 'no line of sight to reference face',
        timestamp: Date.now(),
        serverId: 'srv_1',
        batchId: 'batch-1',
        validationRunId: 'lvr_1',
        metadata: {
          reason: 'line-of-sight',
          target: { x: 12, y: 64, z: 1, blockName: 'dirt' },
          referenceFace: { x: 0, y: 1, z: 0 },
        },
      },
    ]);

    await service.executeScenario(createRun());

    expect(validationEvidence.appendBotEventEvidence).toHaveBeenCalledWith(
      'lvr_1',
      '采集与放置检查',
      expect.objectContaining({
        buildFailureReasonCounts: {
          'occupied-target': 1,
          'line-of-sight': 1,
        },
        buildFailureSamples: expect.arrayContaining([
          expect.objectContaining({
            botName: 'bot-1',
            reason: 'occupied-target',
          }),
          expect.objectContaining({
            botName: 'bot-2',
            reason: 'line-of-sight',
          }),
        ]),
      }),
    );
  });
});
