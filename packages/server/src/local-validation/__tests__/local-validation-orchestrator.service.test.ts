import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalValidationRunDto } from '@jian-agent/shared-domain';
import { LocalValidationOrchestratorService } from '../local-validation-orchestrator.service.js';

describe('LocalValidationOrchestratorService', () => {
  let orchestrator: LocalValidationOrchestratorService;

  function createRun(overrides: Partial<LocalValidationRunDto> = {}): LocalValidationRunDto {
    return {
      id: 'lvr_1',
      name: 'paper smoke',
      mode: 'init-paper',
      paperVersion: '1.21.1',
      scenarioPackId: 'combat-pack-v1',
      requestedBotCount: 8,
      effectiveBotCount: 0,
      requestedBy: 'admin',
      keepServerRunning: false,
      keepWorkspace: false,
      workspacePath: '/tmp/run',
      status: 'CREATED',
      ...overrides,
    };
  }

  const provisioning = {
    initializePaperWorkspace: vi.fn().mockResolvedValue({
      jarPath: '/tmp/run/paper.jar',
      workDir: '/tmp/run',
      paperVersion: '1.21.1',
      build: 125,
    }),
  };

  const config = {
    id: 'srv_1',
    name: 'paper smoke',
    serverType: 'managed' as const,
    javaPath: 'java',
    jarPath: '/tmp/run/paper.jar',
    workDir: '/tmp/run',
    jvmArgs: [],
    serverArgs: [],
    envVars: {},
    encoding: 'utf-8',
    autoRestart: false,
    maxRestarts: 0,
    host: '127.0.0.1',
    port: 25565,
    sshHost: '',
    sshPort: 22,
    sshUsername: '',
    sshAuthType: 'password' as const,
    sshPassword: '',
    sshKeyPath: '',
    sshPassphrase: '',
    serverDir: '/tmp/run',
    logsPath: 'logs',
    runtimeId: '',
    probeVersion: '',
    preStartCommand: '',
    postStartCommand: '',
    preStopCommand: '',
    postStopCommand: '',
    scriptTimeoutMs: 30000,
    readyPattern: '',
    readyTimeoutMs: 120000,
    serverGroup: '',
    tags: [],
    description: '',
    createdAt: '2026-04-19T10:00:00.000Z',
    updatedAt: '2026-04-19T10:00:00.000Z',
  };

  const configService = {
    create: vi.fn().mockResolvedValue(config),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  const lifecycle = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  };

  const eventBus = {
    emit: vi.fn(),
  };

  const validationReport = {
    buildReport: vi.fn().mockImplementation((input) => ({
      runId: input.run.id,
      status: input.run.status,
      generatedAt: '2026-04-19T10:00:00.000Z',
      sections: [],
    })),
  };

  const validationEvidence = {
    appendStartupReport: vi.fn().mockResolvedValue({
      id: 'lve_startup',
      runId: 'lvr_1',
      kind: 'operation',
      timestamp: '2026-04-19T10:00:00.000Z',
      summary: '启动报告',
      payload: {},
    }),
    appendFailureEvidence: vi.fn().mockResolvedValue({
      id: 'lve_failure',
      runId: 'lvr_1',
      kind: 'operation',
      timestamp: '2026-04-19T10:00:00.000Z',
      summary: '预检失败',
      payload: {},
    }),
  };

  const scenarioExecutor = {
    executeScenario: vi.fn().mockResolvedValue(undefined),
  };

  const store = {
    requireRun: vi.fn(),
    updateRunStatus: vi.fn().mockImplementation(async (id: string, status: string, patch?: Record<string, unknown>) => ({
      id,
      status,
      ...patch,
    })),
    attachServer: vi.fn().mockImplementation(async (id: string, serverId: string) => ({
      id,
      serverId,
      status: 'PROVISIONING',
    })),
  };

  beforeEach(() => {
    provisioning.initializePaperWorkspace.mockReset().mockResolvedValue({
      jarPath: '/tmp/run/paper.jar',
      workDir: '/tmp/run',
      paperVersion: '1.21.1',
      build: 125,
    });
    configService.create.mockReset().mockResolvedValue(config);
    configService.delete.mockReset().mockResolvedValue(undefined);
    lifecycle.start.mockReset().mockResolvedValue(undefined);
    lifecycle.stop.mockReset().mockResolvedValue(undefined);
    store.requireRun.mockReset().mockResolvedValue(createRun());
    store.updateRunStatus.mockReset().mockImplementation(async (id: string, status: string, patch?: Record<string, unknown>) => ({
      id,
      status,
      ...patch,
    }));
    store.attachServer.mockReset().mockImplementation(async (id: string, serverId: string) => ({
      id,
      serverId,
      status: 'PROVISIONING',
    }));
    eventBus.emit.mockReset();
    validationReport.buildReport.mockReset().mockImplementation((input) => ({
      runId: input.run.id,
      status: input.run.status,
      generatedAt: '2026-04-19T10:00:00.000Z',
      sections: [],
    }));
    validationEvidence.appendStartupReport.mockReset().mockResolvedValue({
      id: 'lve_startup',
      runId: 'lvr_1',
      kind: 'operation',
      timestamp: '2026-04-19T10:00:00.000Z',
      summary: '启动报告',
      payload: {},
    });
    validationEvidence.appendFailureEvidence.mockReset().mockResolvedValue({
      id: 'lve_failure',
      runId: 'lvr_1',
      kind: 'operation',
      timestamp: '2026-04-19T10:00:00.000Z',
      summary: '预检失败',
      payload: {},
    });
    scenarioExecutor.executeScenario.mockReset().mockResolvedValue(undefined);
    orchestrator = new LocalValidationOrchestratorService(
      store as never,
      provisioning as never,
      configService as never,
      lifecycle as never,
      eventBus as never,
      validationReport as never,
      validationEvidence as never,
      scenarioExecutor as never,
    );
  });

  it('creates a managed server config and starts lifecycle for init-paper runs', async () => {
    const run = createRun();

    const startedRun = await orchestrator.startRun(run);

    expect(store.requireRun).toHaveBeenCalledWith('lvr_1');
    expect(store.updateRunStatus).toHaveBeenNthCalledWith(1, 'lvr_1', 'PROVISIONING', {});
    expect(eventBus.emit).toHaveBeenCalledWith(
      'local-validation.run',
      expect.objectContaining({
        runId: 'lvr_1',
        status: 'READY',
      }),
    );
    const provisioningInput = provisioning.initializePaperWorkspace.mock.calls[0]?.[0];
    expect(provisioningInput).toEqual({
      workspacePath: '/tmp/run',
      version: '1.21.1',
      port: expect.any(Number),
    });
    expect(configService.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'paper smoke',
      serverType: 'managed',
      javaPath: 'java',
      jarPath: '/tmp/run/paper.jar',
      workDir: '/tmp/run',
      host: '127.0.0.1',
      port: provisioningInput.port,
      serverDir: '/tmp/run',
      logsPath: 'logs',
      tags: ['local-validation'],
    }));
    expect(store.attachServer).toHaveBeenCalledWith('lvr_1', 'srv_1');
    expect(store.updateRunStatus).toHaveBeenNthCalledWith(
      2,
      'lvr_1',
      'STARTING',
      expect.objectContaining({
        serverId: 'srv_1',
        paperVersion: '1.21.1',
      }),
    );
    expect(lifecycle.start).toHaveBeenCalledWith('srv_1', expect.objectContaining({ workDir: '/tmp/run' }));
    expect(store.updateRunStatus).toHaveBeenNthCalledWith(
      3,
      'lvr_1',
      'READY',
      expect.objectContaining({
        serverId: 'srv_1',
        paperVersion: '1.21.1',
      }),
    );
    expect(validationReport.buildReport).toHaveBeenCalledWith(
      expect.objectContaining({
        run: expect.objectContaining({
          id: 'lvr_1',
          status: 'READY',
        }),
      }),
    );
    expect(validationEvidence.appendStartupReport).toHaveBeenCalledWith(
      'lvr_1',
      expect.objectContaining({
        runId: 'lvr_1',
        status: 'READY',
      }),
    );
    expect(scenarioExecutor.executeScenario).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'lvr_1',
        status: 'READY',
        serverId: 'srv_1',
      }),
    );
    expect(startedRun).toEqual(
      expect.objectContaining({
        id: 'lvr_1',
        status: 'READY',
        serverId: 'srv_1',
        paperVersion: '1.21.1',
      }),
    );
  });

  it('rejects duplicate starts once the stored run has left CREATED', async () => {
    const staleRun = createRun();
    store.requireRun.mockResolvedValue(createRun({ status: 'PROVISIONING' }));

    await expect(orchestrator.startRun(staleRun)).rejects.toThrow('Local validation run lvr_1 can only be started from CREATED');

    expect(provisioning.initializePaperWorkspace).not.toHaveBeenCalled();
    expect(configService.create).not.toHaveBeenCalled();
    expect(lifecycle.start).not.toHaveBeenCalled();
  });

  it('rejects a second in-flight start attempt without reprovisioning', async () => {
    let markProvisioningStarted: (() => void) | undefined;
    const provisioningStarted = new Promise<void>((resolve) => {
      markProvisioningStarted = resolve;
    });
    let releaseProvisioning: (() => void) | undefined;
    provisioning.initializePaperWorkspace.mockImplementation(
      () =>
        new Promise((resolve) => {
          markProvisioningStarted?.();
          releaseProvisioning = () =>
            resolve({
              jarPath: '/tmp/run/paper.jar',
              workDir: '/tmp/run',
              paperVersion: '1.21.1',
              build: 125,
            });
        }),
    );

    const firstStart = orchestrator.startRun(createRun());
    await provisioningStarted;

    await expect(orchestrator.startRun(createRun())).rejects.toThrow(
      'Local validation run lvr_1 is already being started',
    );
    expect(provisioning.initializePaperWorkspace).toHaveBeenCalledTimes(1);
    expect(configService.create).toHaveBeenCalledTimes(0);

    releaseProvisioning?.();
    await firstStart;
  });

  it('maps provisioning initialization failures to FAILED_PROVISION', async () => {
    provisioning.initializePaperWorkspace.mockImplementationOnce(async () => {
      throw new Error('disk full');
    });

    await expect(orchestrator.startRun(createRun())).rejects.toThrow('disk full');

    expect(store.updateRunStatus).toHaveBeenNthCalledWith(1, 'lvr_1', 'PROVISIONING', {});
    expect(store.updateRunStatus).toHaveBeenNthCalledWith(
      2,
      'lvr_1',
      'FAILED_PROVISION',
      expect.objectContaining({
        failureCode: 'paper_workspace_init_failed',
        failureMessage: 'disk full',
      }),
    );
    expect(validationEvidence.appendFailureEvidence).toHaveBeenCalledWith(
      'lvr_1',
      '预检失败',
      expect.objectContaining({
        failureCode: 'paper_workspace_init_failed',
        failureMessage: 'disk full',
      }),
    );
    expect(configService.create).not.toHaveBeenCalled();
    expect(lifecycle.start).not.toHaveBeenCalled();
  });

  it('maps server config creation failures to FAILED_PROVISION', async () => {
    configService.create.mockRejectedValueOnce(new Error('config write failed'));

    await expect(orchestrator.startRun(createRun())).rejects.toThrow('config write failed');

    expect(store.updateRunStatus).toHaveBeenNthCalledWith(
      2,
      'lvr_1',
      'FAILED_PROVISION',
      expect.objectContaining({
        failureCode: 'managed_server_config_create_failed',
        failureMessage: 'config write failed',
      }),
    );
    expect(validationEvidence.appendFailureEvidence).toHaveBeenCalledWith(
      'lvr_1',
      '预检失败',
      expect.objectContaining({
        failureCode: 'managed_server_config_create_failed',
        failureMessage: 'config write failed',
      }),
    );
    expect(lifecycle.start).not.toHaveBeenCalled();
  });

  it('maps lifecycle start failures to FAILED_STARTUP', async () => {
    lifecycle.start.mockRejectedValueOnce(new Error('boot timeout'));

    await expect(orchestrator.startRun(createRun())).rejects.toThrow('boot timeout');

    expect(store.updateRunStatus).toHaveBeenNthCalledWith(
      3,
      'lvr_1',
      'FAILED_STARTUP',
      expect.objectContaining({
        serverId: 'srv_1',
        failureCode: 'managed_server_start_failed',
        failureMessage: 'boot timeout',
      }),
    );
    expect(validationEvidence.appendFailureEvidence).toHaveBeenCalledWith(
      'lvr_1',
      '启动失败',
      expect.objectContaining({
        failureCode: 'managed_server_start_failed',
        failureMessage: 'boot timeout',
      }),
    );
  });

  it('rolls back the run and deletes the created config if attachServer fails before lifecycle start', async () => {
    store.attachServer.mockRejectedValueOnce(new Error('attach failed'));

    await expect(orchestrator.startRun(createRun())).rejects.toThrow('attach failed');

    expect(configService.create).toHaveBeenCalledTimes(1);
    expect(configService.delete).toHaveBeenCalledWith('srv_1');
    expect(store.updateRunStatus).toHaveBeenLastCalledWith(
      'lvr_1',
      'CREATED',
      expect.objectContaining({
        serverId: null,
        failureCode: null,
        failureMessage: null,
        startedAt: null,
        finishedAt: null,
      }),
    );
    expect(validationEvidence.appendFailureEvidence).not.toHaveBeenCalled();
    expect(lifecycle.start).not.toHaveBeenCalled();
  });

  it('marks FAILED_PROVISION with retained server linkage if config delete fails during pre-start compensation', async () => {
    store.attachServer.mockRejectedValueOnce(new Error('attach failed'));
    configService.delete.mockRejectedValueOnce(new Error('delete failed'));

    await expect(orchestrator.startRun(createRun())).rejects.toThrow('attach failed');

    expect(configService.delete).toHaveBeenCalledWith('srv_1');
    expect(store.updateRunStatus).toHaveBeenLastCalledWith(
      'lvr_1',
      'FAILED_PROVISION',
      expect.objectContaining({
        serverId: 'srv_1',
        failureCode: 'managed_server_bookkeeping_failed',
      }),
    );
    expect(validationEvidence.appendFailureEvidence).toHaveBeenCalledWith(
      'lvr_1',
      '预检失败',
      expect.objectContaining({
        status: 'FAILED_PROVISION',
        serverId: 'srv_1',
        failureCode: 'managed_server_bookkeeping_failed',
      }),
    );
  });

  it('falls back to FAILED_PROVISION if rollback to CREATED fails after successful pre-start cleanup', async () => {
    store.attachServer.mockRejectedValueOnce(new Error('attach failed'));
    store.updateRunStatus.mockReset().mockImplementation(async (id: string, status: string, patch?: Record<string, unknown>) => {
      if (status === 'CREATED') {
        throw new Error('rollback write failed');
      }

      return {
        id,
        status,
        ...patch,
      };
    });

    await expect(orchestrator.startRun(createRun())).rejects.toThrow('attach failed');

    expect(configService.delete).toHaveBeenCalledWith('srv_1');
    expect(store.updateRunStatus).toHaveBeenNthCalledWith(
      2,
      'lvr_1',
      'FAILED_PROVISION',
      expect.objectContaining({
        serverId: 'srv_1',
        failureCode: 'managed_server_bookkeeping_failed',
        failureMessage: 'attach failed',
      }),
    );
    expect(store.updateRunStatus).toHaveBeenLastCalledWith(
      'lvr_1',
      'FAILED_PROVISION',
      expect.objectContaining({
        serverId: null,
        failureCode: 'managed_server_bookkeeping_failed',
        failureMessage: 'attach failed',
      }),
    );
    expect(validationEvidence.appendFailureEvidence).toHaveBeenCalledWith(
      'lvr_1',
      '预检失败',
      expect.objectContaining({
        status: 'FAILED_PROVISION',
        serverId: null,
        failureCode: 'managed_server_bookkeeping_failed',
      }),
    );
  });

  it('still deletes config and rolls back when the first FAILED_PROVISION compensation write fails', async () => {
    store.attachServer.mockRejectedValueOnce(new Error('attach failed'));
    let failedProvisionAttempts = 0;
    store.updateRunStatus.mockReset().mockImplementation(async (id: string, status: string, patch?: Record<string, unknown>) => {
      if (status === 'FAILED_PROVISION' && failedProvisionAttempts++ === 0) {
        throw new Error('failed_provision write failed');
      }

      return {
        id,
        status,
        ...patch,
      };
    });

    await expect(orchestrator.startRun(createRun())).rejects.toThrow('attach failed');

    expect(configService.delete).toHaveBeenCalledWith('srv_1');
    expect(store.updateRunStatus).toHaveBeenLastCalledWith(
      'lvr_1',
      'CREATED',
      expect.objectContaining({
        serverId: null,
        failureCode: null,
        failureMessage: null,
      }),
    );
  });

  it('retries FAILED_PROVISION with server linkage if delete also fails after the initial failure write fails', async () => {
    store.attachServer.mockRejectedValueOnce(new Error('attach failed'));
    configService.delete.mockRejectedValueOnce(new Error('delete failed'));
    let failedProvisionAttempts = 0;
    store.updateRunStatus.mockReset().mockImplementation(async (id: string, status: string, patch?: Record<string, unknown>) => {
      if (status === 'FAILED_PROVISION' && failedProvisionAttempts++ === 0) {
        throw new Error('failed_provision write failed');
      }

      return {
        id,
        status,
        ...patch,
      };
    });

    await expect(orchestrator.startRun(createRun())).rejects.toThrow('attach failed');

    expect(configService.delete).toHaveBeenCalledWith('srv_1');
    expect(store.updateRunStatus).toHaveBeenNthCalledWith(
      3,
      'lvr_1',
      'FAILED_PROVISION',
      expect.objectContaining({
        serverId: 'srv_1',
        failureCode: 'managed_server_bookkeeping_failed',
        failureMessage: 'attach failed',
      }),
    );
    expect(store.updateRunStatus).toHaveBeenLastCalledWith(
      'lvr_1',
      'FAILED_PROVISION',
      expect.objectContaining({
        serverId: 'srv_1',
        failureCode: 'managed_server_bookkeeping_failed',
        failureMessage: 'attach failed',
      }),
    );
  });

  it('stops the started server, deletes config, and rolls back the run if READY persistence fails', async () => {
    store.updateRunStatus.mockReset().mockImplementation(async (id: string, status: string, patch?: Record<string, unknown>) => {
      if (status === 'READY') {
        throw new Error('ready write failed');
      }

      return {
        id,
        status,
        ...patch,
      };
    });

    await expect(orchestrator.startRun(createRun())).rejects.toThrow('ready write failed');

    expect(lifecycle.start).toHaveBeenCalledWith('srv_1', expect.objectContaining({ workDir: '/tmp/run' }));
    expect(lifecycle.stop).toHaveBeenCalledWith('srv_1', true);
    expect(configService.delete).toHaveBeenCalledWith('srv_1');
    expect(store.updateRunStatus).toHaveBeenLastCalledWith(
      'lvr_1',
      'CREATED',
      expect.objectContaining({
        serverId: null,
        failureCode: null,
        failureMessage: null,
        startedAt: null,
        finishedAt: null,
      }),
    );
    expect(validationEvidence.appendFailureEvidence).not.toHaveBeenCalled();
  });

  it('marks FAILED_STARTUP with retained server linkage if stop fails during READY compensation', async () => {
    store.updateRunStatus.mockReset().mockImplementation(async (id: string, status: string, patch?: Record<string, unknown>) => {
      if (status === 'READY') {
        throw new Error('ready write failed');
      }

      return {
        id,
        status,
        ...patch,
      };
    });
    lifecycle.stop.mockRejectedValueOnce(new Error('stop failed'));

    await expect(orchestrator.startRun(createRun())).rejects.toThrow('ready write failed');

    expect(lifecycle.stop).toHaveBeenCalledWith('srv_1', true);
    expect(configService.delete).not.toHaveBeenCalled();
    expect(store.updateRunStatus).toHaveBeenLastCalledWith(
      'lvr_1',
      'FAILED_STARTUP',
      expect.objectContaining({
        serverId: 'srv_1',
        failureCode: 'managed_server_ready_persist_failed',
      }),
    );
    expect(validationEvidence.appendFailureEvidence).toHaveBeenCalledWith(
      'lvr_1',
      '启动失败',
      expect.objectContaining({
        status: 'FAILED_STARTUP',
        serverId: 'srv_1',
        failureCode: 'managed_server_ready_persist_failed',
      }),
    );
  });

  it('falls back to FAILED_STARTUP if rollback to CREATED fails after successful READY cleanup', async () => {
    store.updateRunStatus.mockReset().mockImplementation(async (id: string, status: string, patch?: Record<string, unknown>) => {
      if (status === 'READY' || status === 'CREATED') {
        throw new Error(`${status.toLowerCase()} write failed`);
      }

      return {
        id,
        status,
        ...patch,
      };
    });

    await expect(orchestrator.startRun(createRun())).rejects.toThrow('ready write failed');

    expect(lifecycle.stop).toHaveBeenCalledWith('srv_1', true);
    expect(configService.delete).toHaveBeenCalledWith('srv_1');
    expect(store.updateRunStatus).toHaveBeenNthCalledWith(
      4,
      'lvr_1',
      'FAILED_STARTUP',
      expect.objectContaining({
        serverId: 'srv_1',
        failureCode: 'managed_server_ready_persist_failed',
        failureMessage: 'ready write failed',
      }),
    );
    expect(store.updateRunStatus).toHaveBeenLastCalledWith(
      'lvr_1',
      'FAILED_STARTUP',
      expect.objectContaining({
        serverId: null,
        failureCode: 'managed_server_ready_persist_failed',
        failureMessage: 'ready write failed',
      }),
    );
    expect(validationEvidence.appendFailureEvidence).toHaveBeenCalledWith(
      'lvr_1',
      '启动失败',
      expect.objectContaining({
        status: 'FAILED_STARTUP',
        serverId: null,
        failureCode: 'managed_server_ready_persist_failed',
      }),
    );
  });

  it('still stops and deletes when the first FAILED_STARTUP compensation write fails', async () => {
    let failedStartupAttempts = 0;
    store.updateRunStatus.mockReset().mockImplementation(async (id: string, status: string, patch?: Record<string, unknown>) => {
      if (status === 'READY') {
        throw new Error('ready write failed');
      }
      if (status === 'FAILED_STARTUP' && failedStartupAttempts++ === 0) {
        throw new Error('failed_startup write failed');
      }

      return {
        id,
        status,
        ...patch,
      };
    });

    await expect(orchestrator.startRun(createRun())).rejects.toThrow('ready write failed');

    expect(lifecycle.stop).toHaveBeenCalledWith('srv_1', true);
    expect(configService.delete).toHaveBeenCalledWith('srv_1');
    expect(store.updateRunStatus).toHaveBeenLastCalledWith(
      'lvr_1',
      'CREATED',
      expect.objectContaining({
        serverId: null,
        failureCode: null,
        failureMessage: null,
      }),
    );
  });

  it('retries FAILED_STARTUP with server linkage if stop fails after the initial failure write fails', async () => {
    let failedStartupAttempts = 0;
    store.updateRunStatus.mockReset().mockImplementation(async (id: string, status: string, patch?: Record<string, unknown>) => {
      if (status === 'READY') {
        throw new Error('ready write failed');
      }
      if (status === 'FAILED_STARTUP' && failedStartupAttempts++ === 0) {
        throw new Error('failed_startup write failed');
      }

      return {
        id,
        status,
        ...patch,
      };
    });
    lifecycle.stop.mockRejectedValueOnce(new Error('stop failed'));

    await expect(orchestrator.startRun(createRun())).rejects.toThrow('ready write failed');

    expect(lifecycle.stop).toHaveBeenCalledWith('srv_1', true);
    expect(configService.delete).not.toHaveBeenCalled();
    expect(store.updateRunStatus).toHaveBeenNthCalledWith(
      5,
      'lvr_1',
      'FAILED_STARTUP',
      expect.objectContaining({
        serverId: 'srv_1',
        failureCode: 'managed_server_ready_persist_failed',
        failureMessage: 'ready write failed',
      }),
    );
    expect(store.updateRunStatus).toHaveBeenLastCalledWith(
      'lvr_1',
      'FAILED_STARTUP',
      expect.objectContaining({
        serverId: 'srv_1',
        failureCode: 'managed_server_ready_persist_failed',
        failureMessage: 'ready write failed',
      }),
    );
  });

  it('retries FAILED_STARTUP with server linkage if delete fails after stop succeeds and the initial failure write fails', async () => {
    let failedStartupAttempts = 0;
    store.updateRunStatus.mockReset().mockImplementation(async (id: string, status: string, patch?: Record<string, unknown>) => {
      if (status === 'READY') {
        throw new Error('ready write failed');
      }
      if (status === 'FAILED_STARTUP' && failedStartupAttempts++ === 0) {
        throw new Error('failed_startup write failed');
      }

      return {
        id,
        status,
        ...patch,
      };
    });
    configService.delete.mockRejectedValueOnce(new Error('delete failed'));

    await expect(orchestrator.startRun(createRun())).rejects.toThrow('ready write failed');

    expect(lifecycle.stop).toHaveBeenCalledWith('srv_1', true);
    expect(configService.delete).toHaveBeenCalledWith('srv_1');
    expect(store.updateRunStatus).toHaveBeenNthCalledWith(
      5,
      'lvr_1',
      'FAILED_STARTUP',
      expect.objectContaining({
        serverId: 'srv_1',
        failureCode: 'managed_server_ready_persist_failed',
        failureMessage: 'ready write failed',
      }),
    );
    expect(store.updateRunStatus).toHaveBeenLastCalledWith(
      'lvr_1',
      'FAILED_STARTUP',
      expect.objectContaining({
        serverId: 'srv_1',
        failureCode: 'managed_server_ready_persist_failed',
        failureMessage: 'ready write failed',
      }),
    );
  });
});
