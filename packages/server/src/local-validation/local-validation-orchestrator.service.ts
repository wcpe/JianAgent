import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { CreateServerConfigRequest, LocalValidationRunDto } from '@jian-agent/shared-domain';
import { createServer } from 'node:net';
import { ServerLifecycleEngine } from '../server-process/lifecycle/lifecycle-engine.service.js';
import { ServerConfigService } from '../server-process/server-config.service.js';
import { LocalServerProvisioningService } from './local-server-provisioning.service.js';
import { LocalValidationScenarioService } from './local-validation-scenario.service.js';
import { LocalValidationStore } from './local-validation.store.js';
import { ValidationEvidenceService } from './validation-evidence.service.js';
import { ValidationReportService } from './validation-report.service.js';

@Injectable()
export class LocalValidationOrchestratorService {
  private readonly logger = new Logger(LocalValidationOrchestratorService.name);
  private readonly activeStarts = new Set<string>();

  constructor(
    private readonly store: LocalValidationStore,
    private readonly provisioning: LocalServerProvisioningService,
    private readonly configService: ServerConfigService,
    private readonly lifecycle: ServerLifecycleEngine,
    private readonly eventBus: EventEmitter2,
    private readonly validationReport: ValidationReportService,
    private readonly validationEvidence: ValidationEvidenceService,
    private readonly scenarioExecutor: LocalValidationScenarioService,
  ) {}

  async startRun(run: LocalValidationRunDto): Promise<LocalValidationRunDto> {
    if (this.activeStarts.has(run.id)) {
      throw new ConflictException(`Local validation run ${run.id} is already being started`);
    }

    this.activeStarts.add(run.id);
    try {
      const currentRun = await this.store.requireRun(run.id);
      if (currentRun.status !== 'CREATED') {
        throw new ConflictException(`Local validation run ${run.id} can only be started from CREATED`);
      }
      if (currentRun.mode !== 'init-paper') {
        throw new BadRequestException(`Local validation mode ${currentRun.mode} is not supported yet`);
      }

      await this.updateRunStatusAndEmit(run.id, 'PROVISIONING');

      const provisionPlan = await this.prepareProvisioning(currentRun);
      const config = await this.createManagedServerConfig(currentRun, provisionPlan);
      try {
        const attachedRun = await this.store.attachServer(run.id, config.id);
        this.emitRunEvent(attachedRun);

        await this.updateRunStatusAndEmit(run.id, 'STARTING', {
          serverId: config.id,
          paperVersion: provisionPlan.paperVersion,
        });
      } catch (error) {
        await this.compensatePreStartBookkeepingFailure(run.id, config.id, provisionPlan.paperVersion, error);
        throw error;
      }

      try {
        await this.lifecycle.start(config.id, config);
      } catch (error) {
        await this.persistRunFailureStatus(run.id, 'FAILED_STARTUP', config.id, provisionPlan.paperVersion, 'managed_server_start_failed', error);
        await this.recordFailureEvidence(run.id, '启动失败', {
          status: 'FAILED_STARTUP',
          serverId: config.id,
          paperVersion: provisionPlan.paperVersion,
          failureCode: 'managed_server_start_failed',
          failureMessage: this.toFailureMessage(error),
          phase: 'startup',
        });
        throw error;
      }

      try {
        const readyRun = await this.updateRunStatusAndEmit(run.id, 'READY', {
          serverId: config.id,
          paperVersion: provisionPlan.paperVersion,
        });
        await this.recordStartupEvidence({
          ...readyRun,
          scenarioPackId: currentRun.scenarioPackId,
        });
        void this.scenarioExecutor.executeScenario(readyRun).catch((error: unknown) => {
          this.logger.error(`Failed to execute local validation scenario for run ${readyRun.id}: ${this.toFailureMessage(error)}`);
        });
        return readyRun;
      } catch (error) {
        await this.compensateReadyPersistenceFailure(run.id, config.id, provisionPlan.paperVersion, error);
        throw error;
      }
    } finally {
      this.activeStarts.delete(run.id);
    }
  }

  private buildManagedServerConfig(
    run: LocalValidationRunDto,
    prepared: {
      readonly jarPath: string;
      readonly workDir: string;
      readonly paperVersion: string;
    },
    port: number,
  ): CreateServerConfigRequest {
    return {
      name: run.name,
      serverType: 'managed',
      javaPath: 'java',
      jarPath: prepared.jarPath,
      workDir: prepared.workDir,
      serverDir: prepared.workDir,
      logsPath: 'logs',
      host: '127.0.0.1',
      port,
      description: `Local validation run ${run.id}`,
      tags: ['local-validation'],
    };
  }

  private async prepareProvisioning(run: LocalValidationRunDto): Promise<{
    readonly jarPath: string;
    readonly workDir: string;
    readonly paperVersion: string;
    readonly port: number;
  }> {
    try {
      const port = await this.allocateLocalPort();
      const prepared = await this.provisioning.initializePaperWorkspace({
        workspacePath: run.workspacePath,
        version: run.paperVersion ?? '1.21.1',
        port,
      });

      return {
        ...prepared,
        port,
      };
    } catch (error) {
      await this.persistRunFailureStatus(run.id, 'FAILED_PROVISION', null, run.paperVersion ?? '1.21.1', 'paper_workspace_init_failed', error);
      await this.recordFailureEvidence(run.id, '预检失败', {
        status: 'FAILED_PROVISION',
        serverId: null,
        paperVersion: run.paperVersion ?? '1.21.1',
        failureCode: 'paper_workspace_init_failed',
        failureMessage: this.toFailureMessage(error),
        phase: 'provisioning',
      });
      throw error;
    }
  }

  private async createManagedServerConfig(
    run: LocalValidationRunDto,
    prepared: {
      readonly jarPath: string;
      readonly workDir: string;
      readonly paperVersion: string;
      readonly port: number;
    },
  ) {
    try {
      return await this.configService.create(this.buildManagedServerConfig(run, prepared, prepared.port));
    } catch (error) {
      await this.persistRunFailureStatus(run.id, 'FAILED_PROVISION', null, prepared.paperVersion, 'managed_server_config_create_failed', error);
      await this.recordFailureEvidence(run.id, '预检失败', {
        status: 'FAILED_PROVISION',
        serverId: null,
        paperVersion: prepared.paperVersion,
        failureCode: 'managed_server_config_create_failed',
        failureMessage: this.toFailureMessage(error),
        phase: 'provisioning',
      });
      throw error;
    }
  }

  private async allocateLocalPort(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const server = createServer();
      server.unref();
      server.once('error', reject);
      server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
        const address = server.address();
        if (!address || typeof address === 'string') {
          server.close(() => reject(new Error('Failed to resolve a local validation port')));
          return;
        }

        const { port } = address;
        server.close((closeError) => {
          if (closeError) {
            reject(closeError);
            return;
          }

          resolve(port);
        });
      });
    });
  }

  private toFailureMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private emitRunEvent(run: LocalValidationRunDto): void {
    this.eventBus.emit('local-validation.run', {
      runId: run.id,
      status: run.status,
      serverId: run.serverId,
      paperVersion: run.paperVersion,
      failureCode: run.failureCode,
      failureMessage: run.failureMessage,
      timestamp: Date.now(),
    });
  }

  private async updateRunStatusAndEmit(
    runId: string,
    status: LocalValidationRunDto['status'],
    patch: Record<string, unknown> = {},
  ): Promise<LocalValidationRunDto> {
    const updated = await this.store.updateRunStatus(runId, status, patch);
    this.emitRunEvent(updated);
    return updated;
  }

  private async cleanupCreatedConfig(configId: string): Promise<boolean> {
    try {
      await this.configService.delete(configId);
      return true;
    } catch {
      return false;
    }
  }

  private async rollbackRunToCreated(runId: string): Promise<boolean> {
    try {
      await this.updateRunStatusAndEmit(runId, 'CREATED', {
        serverId: null,
        failureCode: null,
        failureMessage: null,
        startedAt: null,
        finishedAt: null,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async persistRunFailureStatus(
    runId: string,
    status: 'FAILED_PROVISION' | 'FAILED_STARTUP',
    configId: string | null,
    paperVersion: string,
    failureCode: string,
    triggerError: unknown,
  ): Promise<boolean> {
    try {
      await this.updateRunStatusAndEmit(runId, status, {
        serverId: configId,
        paperVersion,
        failureCode,
        failureMessage: this.toFailureMessage(triggerError),
      });
      return true;
    } catch {
      // Best-effort compensation only; preserve the original triggering error.
      return false;
    }
  }

  private async compensatePreStartBookkeepingFailure(
    runId: string,
    configId: string,
    paperVersion: string,
    triggerError: unknown,
  ): Promise<void> {
    const failedPersisted = await this.persistRunFailureStatus(
      runId,
      'FAILED_PROVISION',
      configId,
      paperVersion,
      'managed_server_bookkeeping_failed',
      triggerError,
    );

    const deleteSucceeded = await this.cleanupCreatedConfig(configId);
    if (!deleteSucceeded) {
      if (!failedPersisted) {
        await this.persistRunFailureStatus(
          runId,
          'FAILED_PROVISION',
          configId,
          paperVersion,
          'managed_server_bookkeeping_failed',
          triggerError,
        );
      }
      await this.recordFailureEvidence(runId, '预检失败', {
        status: 'FAILED_PROVISION',
        serverId: configId,
        paperVersion,
        failureCode: 'managed_server_bookkeeping_failed',
        failureMessage: this.toFailureMessage(triggerError),
        phase: 'provisioning',
      });
      return;
    }

    const rollbackSucceeded = await this.rollbackRunToCreated(runId);
    if (rollbackSucceeded) {
      return;
    }

    await this.persistRunFailureStatus(
      runId,
      'FAILED_PROVISION',
      null,
      paperVersion,
      'managed_server_bookkeeping_failed',
      triggerError,
    );
    await this.recordFailureEvidence(runId, '预检失败', {
      status: 'FAILED_PROVISION',
      serverId: null,
      paperVersion,
      failureCode: 'managed_server_bookkeeping_failed',
      failureMessage: this.toFailureMessage(triggerError),
      phase: 'provisioning',
    });
  }

  private async compensateReadyPersistenceFailure(
    runId: string,
    configId: string,
    paperVersion: string,
    triggerError: unknown,
  ): Promise<void> {
    const failedPersisted = await this.persistRunFailureStatus(
      runId,
      'FAILED_STARTUP',
      configId,
      paperVersion,
      'managed_server_ready_persist_failed',
      triggerError,
    );

    try {
      await this.lifecycle.stop(configId, true);
    } catch {
      if (!failedPersisted) {
        await this.persistRunFailureStatus(
          runId,
          'FAILED_STARTUP',
          configId,
          paperVersion,
          'managed_server_ready_persist_failed',
          triggerError,
        );
      }
      await this.recordFailureEvidence(runId, '启动失败', {
        status: 'FAILED_STARTUP',
        serverId: configId,
        paperVersion,
        failureCode: 'managed_server_ready_persist_failed',
        failureMessage: this.toFailureMessage(triggerError),
        phase: 'startup',
      });
      return;
    }

    const deleteSucceeded = await this.cleanupCreatedConfig(configId);
    if (!deleteSucceeded) {
      if (!failedPersisted) {
        await this.persistRunFailureStatus(
          runId,
          'FAILED_STARTUP',
          configId,
          paperVersion,
          'managed_server_ready_persist_failed',
          triggerError,
        );
      }
      await this.recordFailureEvidence(runId, '启动失败', {
        status: 'FAILED_STARTUP',
        serverId: configId,
        paperVersion,
        failureCode: 'managed_server_ready_persist_failed',
        failureMessage: this.toFailureMessage(triggerError),
        phase: 'startup',
      });
      return;
    }

    const rollbackSucceeded = await this.rollbackRunToCreated(runId);
    if (rollbackSucceeded) {
      return;
    }

    await this.persistRunFailureStatus(
      runId,
      'FAILED_STARTUP',
      null,
      paperVersion,
      'managed_server_ready_persist_failed',
      triggerError,
    );
    await this.recordFailureEvidence(runId, '启动失败', {
      status: 'FAILED_STARTUP',
      serverId: null,
      paperVersion,
      failureCode: 'managed_server_ready_persist_failed',
      failureMessage: this.toFailureMessage(triggerError),
      phase: 'startup',
    });
  }

  private async recordStartupEvidence(run: LocalValidationRunDto): Promise<void> {
    try {
      const report = this.validationReport.buildReport({
        run: {
          id: run.id,
          status: run.status,
          scenarioPackId: run.scenarioPackId,
          serverId: run.serverId,
          paperVersion: run.paperVersion,
        },
        startup: {
          readyChecks: ['managed-server-config-created', 'lifecycle-start-success', 'ready-state-persisted'],
        },
        assertions: [],
      });

      await this.validationEvidence.appendStartupReport(run.id, report);
    } catch (error) {
      this.logger.warn(`Failed to append startup evidence for run ${run.id}: ${this.toFailureMessage(error)}`);
    }
  }

  private async recordFailureEvidence(runId: string, summary: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.validationEvidence.appendFailureEvidence(runId, summary, payload);
    } catch (error) {
      this.logger.warn(`Failed to append failure evidence for run ${runId}: ${this.toFailureMessage(error)}`);
    }
  }
}
