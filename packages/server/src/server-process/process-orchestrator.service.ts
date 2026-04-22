import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ProcessManagerService } from './process-manager.service.js';
import { CrashRestartService } from './crash-restart.service.js';
import { ScheduledStopService } from './scheduled-stop.service.js';
import { ConditionalStopService } from './conditional-stop.service.js';
import { HealthMonitorService, type HealthEvent } from './health-monitor.service.js';
import { ServerConfigService } from './server-config.service.js';
import { SnapshotService } from '../plugin-bridge/snapshot.service.js';
import { AlertEngineService } from '../metrics/alert-engine.service.js';
import { ServerState } from '@jian-agent/shared-domain';
import type { ServerCrashedEvent, ServerStateChangedEvent } from '../event-bus/events.js';

/**
 * Orchestrator that wires together:
 * - Crash → CrashRestartService (auto-restart with backoff)
 * - State changes → HealthMonitor start/stop monitoring
 * - Snapshots → AlertEngine + ConditionalStop + HealthMonitor
 * - Health events → AlertEngine alerts
 * - Conditional stop → ProcessManager.stop()
 */
@Injectable()
export class ProcessOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(ProcessOrchestratorService.name);
  private snapshotPollInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly eventBus: EventEmitter2,
    private readonly processManager: ProcessManagerService,
    private readonly crashRestart: CrashRestartService,
    private readonly scheduledStop: ScheduledStopService,
    private readonly conditionalStop: ConditionalStopService,
    private readonly healthMonitor: HealthMonitorService,
    private readonly configService: ServerConfigService,
    private readonly snapshotService: SnapshotService,
    private readonly alertEngine: AlertEngineService,
  ) {}

  onModuleInit(): void {
    // Wire CrashRestartService start callback
    this.crashRestart.setStartCallback(async (serverId: string) => {
      const config = await this.configService.getById(serverId);
      if (!config) {
        this.logger.error(`Cannot auto-restart server ${serverId}: config not found`);
        return;
      }
      await this.processManager.start(config, serverId);
    });

    // Wire ConditionalStopService stop callback
    this.conditionalStop.setStopCallback((serverId: string, reason: string) => {
      this.logger.warn(`Conditional stop triggered for ${serverId}: ${reason}`);
      this.processManager.stop(serverId, false).catch((err) => {
        this.logger.error(`Conditional stop failed for ${serverId}: ${err}`);
      });
    });

    // Wire HealthMonitor event callback → alert system
    this.healthMonitor.setEventCallback((event: HealthEvent) => {
      this.handleHealthEvent(event);
    });

    // Poll snapshots for conditional stop + health monitor integration
    this.snapshotPollInterval = setInterval(() => this.evaluateLatestSnapshots(), 5_000);

    this.logger.log('Process orchestrator initialized — all services wired');
  }

  /** Handle server.crashed events — delegate to CrashRestartService */
  @OnEvent('server.crashed')
  async onServerCrashed(event: ServerCrashedEvent): Promise<void> {
    const { serverId, exitCode } = event;
    this.logger.warn(`Server ${serverId} crashed (exit=${exitCode})`);

    // Fire alert
    this.alertEngine.checkServerState(ServerState.CRASHED);

    // Stop health monitoring
    this.healthMonitor.stopMonitoring(serverId);

    // Auto-restart logic
    const config = await this.configService.getById(serverId);
    if (!config) return;

    const result = await this.crashRestart.handleCrash(
      serverId,
      exitCode ?? null,
      config.autoRestart,
      config.maxRestarts,
    );

    if (result.willRestart) {
      this.logger.log(`Auto-restart scheduled for ${serverId}: attempt ${result.attempt}, delay ${result.delay}ms`);
    } else if (config.autoRestart && result.attempt > config.maxRestarts) {
      this.logger.error(`Server ${serverId} exceeded max restart attempts (${config.maxRestarts})`);
    }
  }

  /** Handle scheduled-restart-stop events — stop then restart the server */
  @OnEvent('scheduled-restart-stop')
  async onScheduledRestartStop(event: { serverId: string }): Promise<void> {
    const { serverId } = event;
    this.logger.log(`Scheduled restart triggered for ${serverId}, stopping first...`);
    try {
      await this.processManager.stop(serverId, false);
    } catch (err) {
      this.logger.error(`Stop failed during scheduled restart for ${serverId}: ${err}`);
    }
    // Wait for process to fully stop
    let waited = 0;
    while (this.processManager.getState(serverId) !== ServerState.STOPPED && waited < 30_000) {
      await new Promise((r) => setTimeout(r, 500));
      waited += 500;
    }
    // Now restart
    try {
      const config = await this.configService.getById(serverId);
      if (config) {
        this.logger.log(`Restarting server ${serverId} after scheduled stop`);
        await this.processManager.start(config, serverId);
      } else {
        this.logger.error(`Cannot restart server ${serverId}: config not found`);
      }
    } catch (err) {
      this.logger.error(`Scheduled restart failed for ${serverId}: ${err}`);
    }
  }

  /** Handle server.state-changed events — manage health monitoring lifecycle */
  @OnEvent('server.state-changed')
  onServerStateChanged(event: ServerStateChangedEvent): void {
    const { serverId, newState } = event;

    if (newState === ServerState.RUNNING && event.pid) {
      // Start health monitoring when server goes RUNNING
      this.healthMonitor.startMonitoring(serverId, event.pid);
      this.logger.log(`Health monitoring started for ${serverId} (pid=${event.pid})`);
    } else if (newState === ServerState.STOPPED || newState === ServerState.CRASHED) {
      this.healthMonitor.stopMonitoring(serverId);
    }

    // Reset crash counter when server has been running stably
    if (newState === ServerState.RUNNING) {
      // Reset after 60s of stable running
      setTimeout(() => {
        const currentState = this.processManager.getState(serverId);
        if (currentState === ServerState.RUNNING) {
          this.crashRestart.resetCount(serverId);
        }
      }, 60_000);
    }
  }

  /** Periodically evaluate latest snapshots for conditional-stop + health + alerts */
  private evaluateLatestSnapshots(): void {
    const snapshots = this.snapshotService.getAllLatest();
    for (const stored of snapshots) {
      const { serverId, snapshot } = stored;

      // Feed to conditional stop evaluator
      this.conditionalStop.evaluateSnapshot(serverId, snapshot);

      // Feed to health monitor (timestamp update)
      this.healthMonitor.onSnapshotReceived(serverId);

      // Feed to alert engine
      this.alertEngine.evaluateSnapshot(serverId, snapshot).catch((err) => {
        this.logger.error(`Alert evaluation failed for ${serverId}: ${err}`);
      });
    }
  }

  /** Transform health events into alert-engine alerts */
  private handleHealthEvent(event: HealthEvent): void {
    const { type, serverId, detail } = event;

    switch (type) {
      case 'pid-changed':
        this.alertEngine.checkServerState(ServerState.CRASHED);
        this.logger.error(`PID changed for server ${serverId}: ${detail}`);
        break;
      case 'unresponsive':
        this.logger.warn(`Server ${serverId} unresponsive: ${detail}`);
        // Emit custom event for WebSocket broadcast
        this.eventBus.emit('server.health', {
          serverId,
          type: 'unresponsive',
          detail,
          timestamp: Date.now(),
        });
        break;
      case 'recovered':
        this.logger.log(`Server ${serverId} recovered: ${detail}`);
        this.eventBus.emit('server.health', {
          serverId,
          type: 'recovered',
          detail,
          timestamp: Date.now(),
        });
        break;
    }
  }
}
