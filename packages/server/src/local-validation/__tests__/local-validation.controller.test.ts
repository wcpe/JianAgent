import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalValidationController } from '../local-validation.controller.js';

describe('LocalValidationController', () => {
  let controller: LocalValidationController;
  const createdWorkspaces: string[] = [];

  const store = {
    listRuns: vi.fn(),
    createDraftRun: vi.fn(),
    findRunById: vi.fn(),
    listStages: vi.fn(),
    listAssertions: vi.fn(),
    listEvidence: vi.fn(),
    updateRunStatus: vi.fn(),
  };

  const orchestrator = {
    startRun: vi.fn(),
  };

  const scenarios = {
    listScenarioPacks: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new LocalValidationController(store as never, orchestrator as never, scenarios as never);
  });

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((workspacePath) => rm(workspacePath, { recursive: true, force: true })));
  });

  it('derives requestedBy from req.user.username and ignores client-supplied requestedBy', async () => {
    store.createDraftRun.mockResolvedValue({ id: 'lvr_1' });
    const maliciousWorkspacePath = '/tmp/../../Users/wxys233/Documents';

    await controller.createRun(
      {
        name: 'paper smoke',
        mode: 'init-paper',
        paperVersion: '1.21.1',
        scenarioPackId: 'combat-pack-v1',
        requestedBotCount: 8,
        requestedBy: 'attacker',
        keepServerRunning: false,
        keepWorkspace: false,
        workspacePath: maliciousWorkspacePath,
        serverId: 'srv_attacker',
        failureCode: 'force_failed',
        failureMessage: 'forced failure',
        startedAt: '2026-04-19T00:00:00.000Z',
        finishedAt: '2026-04-19T00:01:00.000Z',
      } as any,
      { user: { sub: 'user-1', username: 'admin', role: 'admin' } } as any,
    );

    const createInput = store.createDraftRun.mock.calls[0]?.[0];
    createdWorkspaces.push(createInput.workspacePath);
    expect(createInput).toEqual(
      expect.objectContaining({
        requestedBy: 'admin',
      }),
    );
    expect(createInput.workspacePath).not.toBe(maliciousWorkspacePath);
    expect(createInput.workspacePath.startsWith(join(tmpdir(), 'jianagent-local-validation-run-'))).toBe(true);
    expect(basename(createInput.workspacePath).startsWith('jianagent-local-validation-run-')).toBe(true);
    expect(createInput).not.toHaveProperty('serverId');
    expect(createInput).not.toHaveProperty('failureCode');
    expect(createInput).not.toHaveProperty('failureMessage');
    expect(createInput).not.toHaveProperty('startedAt');
    expect(createInput).not.toHaveProperty('finishedAt');
    await expect(access(createInput.workspacePath)).resolves.toBeUndefined();
  });

  it('falls back to req.user.sub when username is absent', async () => {
    store.createDraftRun.mockResolvedValue({ id: 'lvr_1' });

    await controller.createRun(
      {
        name: 'paper smoke',
        mode: 'init-paper',
        paperVersion: '1.21.1',
        scenarioPackId: 'combat-pack-v1',
        requestedBotCount: 8,
        keepServerRunning: false,
        keepWorkspace: false,
        workspacePath: '/tmp/run',
      } as any,
      { user: { sub: 'user-2', role: 'operator' } } as any,
    );

    expect(store.createDraftRun).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedBy: 'user-2',
      }),
    );
  });

  it('rejects unsupported create modes before writing a draft run', async () => {
    await expect(
      controller.createRun(
        {
          name: 'import smoke',
          mode: 'import-existing',
          scenarioPackId: 'combat-pack-v1',
          requestedBotCount: 8,
          keepServerRunning: false,
          keepWorkspace: false,
          workspacePath: '/tmp/run',
        } as any,
        { user: { sub: 'user-1', username: 'admin', role: 'admin' } } as any,
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.createRun(
        {
          name: 'import smoke',
          mode: 'import-existing',
          scenarioPackId: 'combat-pack-v1',
          requestedBotCount: 8,
          keepServerRunning: false,
          keepWorkspace: false,
          workspacePath: '/tmp/run',
        } as any,
        { user: { sub: 'user-1', username: 'admin', role: 'admin' } } as any,
      ),
    ).rejects.toThrow('Local validation mode import-existing is not supported yet');

    expect(store.createDraftRun).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when start target does not exist', async () => {
    store.findRunById.mockResolvedValue(undefined);

    await expect(controller.startRun('missing')).rejects.toThrow(
      new NotFoundException('Local validation run missing not found'),
    );
  });

  it('lists scenario packs from the catalog service', async () => {
    scenarios.listScenarioPacks.mockReturnValue([{ id: 'combat-pack-v1' }]);
    expect(controller.listScenarioPacks()).toEqual([{ id: 'combat-pack-v1' }]);
  });

  it('returns run artifacts through the store list endpoints', async () => {
    store.findRunById.mockResolvedValue({ id: 'run-1', status: 'CREATED' });
    store.listStages.mockResolvedValue([{ id: 'stage-1' }]);
    store.listAssertions.mockResolvedValue([{ id: 'assertion-1' }]);
    store.listEvidence.mockResolvedValue([{ id: 'evidence-1' }]);

    await expect(controller.listStages('run-1')).resolves.toEqual([{ id: 'stage-1' }]);
    await expect(controller.listAssertions('run-1')).resolves.toEqual([{ id: 'assertion-1' }]);
    await expect(controller.listEvidence('run-1')).resolves.toEqual([{ id: 'evidence-1' }]);
  });

  it('cancels CREATED runs and returns terminal runs unchanged', async () => {
    store.findRunById
      .mockResolvedValueOnce({ id: 'run-1', status: 'CREATED' })
      .mockResolvedValueOnce({ id: 'run-2', status: 'CANCELLED' });
    store.updateRunStatus.mockResolvedValue({ id: 'run-1', status: 'CANCELLED' });

    await expect(controller.cancelRun('run-1')).resolves.toEqual({ id: 'run-1', status: 'CANCELLED' });
    expect(store.updateRunStatus).toHaveBeenCalledWith('run-1', 'CANCELLED', { startedAt: null });
    await expect(controller.cancelRun('run-2')).resolves.toEqual({ id: 'run-2', status: 'CANCELLED' });
  });

  it('rejects cancelling active non-terminal runs', async () => {
    store.findRunById.mockResolvedValue({ id: 'run-3', status: 'STARTING' });

    await expect(controller.cancelRun('run-3')).rejects.toThrow(
      new ConflictException('Local validation run run-3 cannot be cancelled from status STARTING'),
    );
  });

  it('throws NotFoundException when artifact endpoints target a missing run', async () => {
    store.findRunById.mockResolvedValue(undefined);

    await expect(controller.listStages('missing')).rejects.toThrow(
      new NotFoundException('Local validation run missing not found'),
    );
  });
});
