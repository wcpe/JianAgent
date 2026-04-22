import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ServerLifecyclePhase,
  DEFAULT_LIFECYCLE_CONFIG,
} from '@jian-agent/shared-domain';
import type {
  LifecycleConfig,
  LifecyclePhaseEvent,
  ServerConfig,
} from '@jian-agent/shared-domain';
import { ProcessManagerService } from '../process-manager.service.js';
import { StartValidatorService } from './start-validator.service.js';
import { ShellHookExecutor } from './shell-hook-executor.service.js';
import { StartReadyDetector } from './start-ready-detector.service.js';

interface EngineState {
  phase: ServerLifecyclePhase;
  config: (Partial<ServerConfig> & { id: string }) | null;
  lifecycleConfig: LifecycleConfig;
}

@Injectable()
export class ServerLifecycleEngine {
  private readonly logger = new Logger(ServerLifecycleEngine.name);
  private readonly engines = new Map<string, EngineState>();

  constructor(
    private readonly processManager: ProcessManagerService,
    private readonly validator: StartValidatorService,
    private readonly hookExecutor: ShellHookExecutor,
    private readonly readyDetector: StartReadyDetector,
    private readonly eventBus: EventEmitter2,
  ) {}

  getPhase(serverId: string): ServerLifecyclePhase {
    return this.engines.get(serverId)?.phase ?? ServerLifecyclePhase.IDLE;
  }

  getConfig(serverId: string): (Partial<ServerConfig> & { id: string }) | null {
    return this.engines.get(serverId)?.config ?? null;
  }

  async start(serverId: string, config: Partial<ServerConfig> & { id: string }): Promise<void> {
    if (this.engines.has(serverId)) {
      const current = this.engines.get(serverId)!;
      if (current.phase === ServerLifecyclePhase.RUNNING || current.phase === ServerLifecyclePhase.STARTING) {
        throw new Error(`Server ${serverId} is already in phase ${current.phase}`);
      }
    }

    const lcConfig = { ...DEFAULT_LIFECYCLE_CONFIG };
    this.engines.set(serverId, { phase: ServerLifecyclePhase.IDLE, config, lifecycleConfig: lcConfig });

    try {
      // Phase 1: VALIDATING
      this.setPhase(serverId, ServerLifecyclePhase.VALIDATING, 'Validating configuration...');
      const validationResult = await this.validator.validate(config);
      if (!validationResult.valid) {
        const msg = validationResult.errors.filter(e => e.severity === 'error').map(e => e.message).join('; ');
        this.setPhase(serverId, ServerLifecyclePhase.FAILED, `Validation failed: ${msg}`);
        throw new Error(`Validation failed: ${msg}`);
      }

      // Phase 2: PRE_START
      if (config.preStartCommand) {
        this.setPhase(serverId, ServerLifecyclePhase.PRE_START, 'Executing preStart hook...');
        const hookResult = await this.hookExecutor.exec(
          config.preStartCommand,
          config.workDir || '.',
          config.scriptTimeoutMs ?? lcConfig.scriptTimeoutMs,
        );
        if (hookResult.exitCode !== 0) {
          this.logger.warn(`preStart hook for ${serverId} exited with code ${hookResult.exitCode}`);
        }
      }

      // Phase 3: STARTING
      this.setPhase(serverId, ServerLifecyclePhase.STARTING, 'Starting server process...');
      await this.processManager.start(config as ServerConfig, serverId);

      // Phase 4: Wait for ready
      const readyResult = await this.readyDetector.waitForReady(
        serverId,
        config.readyPattern || undefined,
        config.readyTimeoutMs ?? lcConfig.readyTimeoutMs,
      );

      if (!readyResult.ready) {
        this.setPhase(serverId, ServerLifecyclePhase.FAILED, 'Server start timed out — process did not become ready');
        await this.processManager.stop(serverId, true).catch(() => {});
        throw new Error('Server start timed out');
      }

      // Phase 5: POST_START
      if (config.postStartCommand) {
        this.setPhase(serverId, ServerLifecyclePhase.POST_START, 'Executing postStart hook...');
        await this.hookExecutor.exec(
          config.postStartCommand,
          config.workDir || '.',
          config.scriptTimeoutMs ?? lcConfig.scriptTimeoutMs,
        );
      }

      // Done!
      this.setPhase(serverId, ServerLifecyclePhase.RUNNING, 'Server is ready');
      this.logger.log(`Server ${serverId} fully started and ready`);
    } catch (err) {
      if (this.getPhase(serverId) !== ServerLifecyclePhase.FAILED) {
        this.setPhase(serverId, ServerLifecyclePhase.FAILED, `Start failed: ${err}`);
      }
      throw err;
    }
  }

  async stop(serverId: string, force = false): Promise<void> {
    const state = this.engines.get(serverId);
    if (!state || (state.phase !== ServerLifecyclePhase.RUNNING && state.phase !== ServerLifecyclePhase.STARTING)) {
      throw new Error(`Server ${serverId} is not running (phase: ${state?.phase ?? 'IDLE'})`);
    }

    const config = state.config;
    const lcConfig = state.lifecycleConfig;

    try {
      // Phase 1: PRE_STOPPING
      if (config?.preStopCommand) {
        this.setPhase(serverId, ServerLifecyclePhase.PRE_STOPPING, 'Executing preStop hook...');
        await this.hookExecutor.exec(
          config.preStopCommand,
          config.workDir || '.',
          config.scriptTimeoutMs ?? lcConfig.scriptTimeoutMs,
        );
      }

      // Phase 2: STOPPING
      this.setPhase(serverId, ServerLifecyclePhase.STOPPING, force ? 'Force stopping...' : 'Gracefully stopping...');
      await this.processManager.stop(serverId, force);

      // Phase 3: POST_STOPPING
      if (config?.postStopCommand) {
        this.setPhase(serverId, ServerLifecyclePhase.POST_STOPPING, 'Executing postStop hook...');
        await this.hookExecutor.exec(
          config.postStopCommand,
          config.workDir || '.',
          config.scriptTimeoutMs ?? lcConfig.scriptTimeoutMs,
        );
      }

      this.setPhase(serverId, ServerLifecyclePhase.STOPPED, 'Server stopped');
    } catch (err) {
      this.setPhase(serverId, ServerLifecyclePhase.FAILED, `Stop failed: ${err}`);
      throw err;
    }
  }

  async restart(serverId: string): Promise<void> {
    const state = this.engines.get(serverId);
    if (!state?.config) throw new Error(`No config for server ${serverId}`);

    if (state.phase === ServerLifecyclePhase.RUNNING || state.phase === ServerLifecyclePhase.STARTING) {
      await this.stop(serverId, false);
    }

    await this.start(serverId, state.config);
  }

  /** Reset to IDLE (e.g. after external stop or crash) */
  reset(serverId: string): void {
    this.engines.delete(serverId);
  }

  private setPhase(serverId: string, newPhase: ServerLifecyclePhase, message: string): void {
    const state = this.engines.get(serverId);
    const prev = state?.phase ?? ServerLifecyclePhase.IDLE;

    if (state) {
      state.phase = newPhase;
    }

    const event: LifecyclePhaseEvent = {
      serverId,
      phase: newPhase,
      previousPhase: prev,
      message,
      timestamp: Date.now(),
    };

    this.eventBus.emit('server.lifecycle-phase', event);
    this.logger.log(`[${serverId}] ${prev} -> ${newPhase}: ${message}`);
  }
}
