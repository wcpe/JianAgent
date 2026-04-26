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
import { readStartPolicyConfig } from '../../common/network-config.js';

interface LifecycleOperationOptions {
  readonly idempotencyKey?: string;
}

interface StartRetryConfig {
  readonly attempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

interface EngineState {
  phase: ServerLifecyclePhase;
  config: (Partial<ServerConfig> & { id: string }) | null;
  lifecycleConfig: LifecycleConfig;
}

@Injectable()
export class ServerLifecycleEngine {
  private readonly logger = new Logger(ServerLifecycleEngine.name);
  private readonly engines = new Map<string, EngineState>();
  private readonly operationLocks = new Map<string, Promise<void>>();
  private readonly idempotentOperations = new Map<string, Promise<void>>();

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

  async start(
    serverId: string,
    config: Partial<ServerConfig> & { id: string },
    options: LifecycleOperationOptions = {},
  ): Promise<void> {
    return this.withIdempotentOperation(serverId, 'start', options.idempotencyKey, () =>
      this.withServerLock(serverId, () => this.startUnsafe(serverId, config)),
    );
  }

  async stop(serverId: string, force = false, options: LifecycleOperationOptions = {}): Promise<void> {
    return this.withIdempotentOperation(serverId, 'stop', options.idempotencyKey, () =>
      this.withServerLock(serverId, () => this.stopUnsafe(serverId, force)),
    );
  }

  async restart(serverId: string, options: LifecycleOperationOptions = {}): Promise<void> {
    return this.withIdempotentOperation(serverId, 'restart', options.idempotencyKey, () =>
      this.withServerLock(serverId, async () => {
        const state = this.engines.get(serverId);
        if (!state?.config) throw new Error(`No config for server ${serverId}`);

        const requiresStop = state.phase !== ServerLifecyclePhase.FAILED
          && state.phase !== ServerLifecyclePhase.STOPPED
          && state.phase !== ServerLifecyclePhase.IDLE;

        if (requiresStop) {
          await this.stopUnsafe(serverId, false);
        }

        await this.startUnsafe(serverId, state.config);
      }),
    );
  }

  /** Reset to IDLE (e.g. after external stop or crash) */
  reset(serverId: string): void {
    this.engines.delete(serverId);
  }

  private withServerLock(serverId: string, action: () => Promise<void>): Promise<void> {
    const previous = (this.operationLocks.get(serverId) ?? Promise.resolve()).catch(() => undefined);
    const current = previous.then(async () => {
      try {
        await action();
      } finally {
        this.operationLocks.delete(serverId);
      }
    });
    this.operationLocks.set(serverId, current);
    return current;
  }

  private withIdempotentOperation(
    serverId: string,
    action: 'start' | 'stop' | 'restart',
    idempotencyKey: string | undefined,
    runner: () => Promise<void>,
  ): Promise<void> {
    if (!idempotencyKey) {
      return runner();
    }

    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) {
      return runner();
    }

    const opKey = `${serverId}::${action}::${normalizedKey}`;
    const existing = this.idempotentOperations.get(opKey);
    if (existing) {
      return existing;
    }

    const current = runner().finally(() => {
      if (this.idempotentOperations.get(opKey) === current) {
        this.idempotentOperations.delete(opKey);
      }
    });
    this.idempotentOperations.set(opKey, current);
    return current;
  }

  private getStartRetryConfig(): StartRetryConfig {
    const policy = readStartPolicyConfig();
    return {
      attempts: Math.max(1, policy.startRetryAttempts),
      baseDelayMs: Math.max(0, policy.startRetryBaseDelayMs),
      maxDelayMs: Math.max(0, policy.startRetryMaxDelayMs),
    };
  }

  private async startUnsafe(
    serverId: string,
    config: Partial<ServerConfig> & { id: string },
  ): Promise<void> {
    const current = this.engines.get(serverId);
    if (current && (current.phase === ServerLifecyclePhase.RUNNING || current.phase === ServerLifecyclePhase.STARTING)) {
      this.logger.warn(`Ignoring duplicate start request for ${serverId} in phase ${current.phase}`);
      return;
    }
    if (
      current && (
        current.phase === ServerLifecyclePhase.PRE_STOPPING
        || current.phase === ServerLifecyclePhase.STOPPING
        || current.phase === ServerLifecyclePhase.POST_STOPPING
      )
    ) {
      this.logger.warn(`Ignoring start request for ${serverId} during stop workflow (${current.phase})`);
      return;
    }

    const lcConfig = { ...DEFAULT_LIFECYCLE_CONFIG };
    const readyConfig = readStartPolicyConfig();
    const startRetry = this.getStartRetryConfig();
    this.engines.set(serverId, {
      phase: current?.phase ?? ServerLifecyclePhase.IDLE,
      config,
      lifecycleConfig: lcConfig,
    });
    if (this.getPhase(serverId) !== ServerLifecyclePhase.IDLE && this.getPhase(serverId) !== ServerLifecyclePhase.FAILED) {
      this.setPhase(serverId, ServerLifecyclePhase.IDLE, 'Reset before start');
    }

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

      // Phase 3: STARTING with optional retries
      await this.startWithRetry(serverId, config, readyConfig, startRetry);

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

  private async startWithRetry(
    serverId: string,
    config: Partial<ServerConfig> & { id: string },
    readyConfig: ReturnType<typeof readStartPolicyConfig>,
    retryConfig: StartRetryConfig,
  ): Promise<void> {
    const readyTimeoutMs = config.readyTimeoutMs ?? readyConfig.timeoutMs;
    let attempt = 1;

    while (attempt <= retryConfig.attempts) {
      try {
        if (attempt > 1) {
          const delay = Math.min(
            retryConfig.baseDelayMs * Math.pow(2, attempt - 2),
            retryConfig.maxDelayMs || Number.MAX_SAFE_INTEGER,
          );
          if (delay > 0) {
            this.logger.warn(`Retrying start for ${serverId} (attempt ${attempt}/${retryConfig.attempts}), delay=${delay}ms`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        this.setPhase(
          serverId,
          ServerLifecyclePhase.STARTING,
          `Starting server process... (attempt ${attempt}/${retryConfig.attempts})`,
        );
        await this.processManager.start(config as ServerConfig, serverId);

        const readyResult = await this.readyDetector.waitForReady(
          serverId,
          config.readyPattern || undefined,
          readyTimeoutMs,
          {
            mode: readyConfig.mode,
            host: config.host,
            port: config.port,
            portCheckTimeoutMs: Math.min(readyTimeoutMs, readyConfig.portCheckTimeoutMs),
            portCheckIntervalMs: readyConfig.portCheckIntervalMs,
          },
        );

        if (!readyResult.ready) {
          this.logger.warn(`Server ${serverId} startup attempt ${attempt}/${retryConfig.attempts} did not become ready`);
          throw new Error('Server start timed out');
        }

        return;
      } catch (err) {
        this.logger.warn(`Start attempt ${attempt} for ${serverId} failed: ${err}`);
        await this.processManager.stop(serverId, true).catch(() => {});

        if (attempt >= retryConfig.attempts) {
          throw err;
        }

        attempt += 1;
      }
    }
  }

  private async stopUnsafe(serverId: string, force = false): Promise<void> {
    const state = this.engines.get(serverId);
    if (!state) {
      this.logger.warn(`Ignoring stop request for unknown server ${serverId}; treated as no-op`);
      return;
    }

    if (state.phase === ServerLifecyclePhase.STOPPED) {
      this.setPhase(serverId, ServerLifecyclePhase.STOPPED, 'Server already stopped');
      return;
    }

    if (state.phase === ServerLifecyclePhase.IDLE && !state.config) {
      this.setPhase(serverId, ServerLifecyclePhase.IDLE, 'Server is idle without config');
      return;
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
      if (this.getPhase(serverId) !== ServerLifecyclePhase.STOPPING) {
        this.setPhase(serverId, ServerLifecyclePhase.STOPPING, force ? 'Force stopping...' : 'Gracefully stopping...');
      }
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
      await this.processManager.stop(serverId, true).catch(() => {});
      throw err;
    }
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
