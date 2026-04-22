import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { WorkerPoolService } from './worker-pool.service';
import { IpcCommand, IpcEvent, type IpcMessage, type StateReportPayload, type BotDetailResponsePayload, type ChatMessagePayload, type EventReportPayload, type BotScript } from '@jian-agent/shared-protocol';
import type { BotInventoryItem, BotNearbyEntity, BotTerrainBlock } from '@jian-agent/shared-domain';
import { ServerConfigService } from '../server-process/server-config.service.js';
import { ProcessManagerService } from '../server-process/process-manager.service.js';
import { MultiServerService } from '../server-process/multi-server.service.js';
import { BotStateService } from './bot-state.service.js';
import { BotRealtimeService } from './bot-realtime.service.js';
import { SavedBotConfigService } from './saved-bot-config.service.js';

interface BotAssignment {
  readonly name: string;
  readonly workerPid: number;
  readonly serverId: string;
  readonly batchId: string;
  readonly savedConfigId?: string;
  /** Optional: associated validation run for write-back context */
  readonly validationRunId?: string;
}

const MAX_BOTS_PER_WORKER = 50;
const MAX_MINECRAFT_USERNAME_LENGTH = 16;

@Injectable()
export class BotOrchestratorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotOrchestratorService.name);
  private readonly assignments = new Map<string, BotAssignment>();
  private readonly recentAssignments = new Map<string, BotAssignment>();
  private readonly pendingDetailRequests = new Map<string, (payload: BotDetailResponsePayload) => void>();

  constructor(
    private readonly pool: WorkerPoolService,
    private readonly configService: ServerConfigService,
    private readonly processManager: ProcessManagerService,
    private readonly multiServer: MultiServerService,
    private readonly botState: BotStateService,
    private readonly botRealtime: BotRealtimeService,
    private readonly savedBotConfig: SavedBotConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Restoring bots from saved configs (autoCreate=true)...');
    try {
      const configs = await this.savedBotConfig.list();
      const autoConfigs = configs.filter((c) => c.autoCreate);
      if (autoConfigs.length === 0) {
        this.logger.log('No auto-create configs found');
        return;
      }
      for (const cfg of autoConfigs) {
        try {
          const result = await this.createBotBatch({
            serverId: cfg.serverId,
            namePrefix: cfg.namePrefix,
            count: cfg.count,
            behavior: cfg.behavior,
            reconnectMaxRetries: cfg.maxRetries,
            savedConfigId: cfg.id,
          });
          this.logger.log(`Auto-created ${result.createdNames.length} bots from config "${cfg.namePrefix}" (${cfg.id})`);
        } catch (err) {
          this.logger.warn(`Failed to auto-create bots from config "${cfg.namePrefix}" (${cfg.id}): ${(err as Error).message}`);
        }
      }
    } catch (err) {
      this.logger.error(`Failed to restore saved bot configs: ${(err as Error).message}`);
    }
  }

  async createBotBatch(params: {
    readonly serverId: string;
    readonly namePrefix: string;
    readonly count: number;
    readonly behavior: string;
    readonly reconnectMaxRetries?: number;
    readonly savedConfigId?: string;
    readonly autoRespawn?: boolean;
    /** Optional: link this batch to a validation run for write-back context */
    readonly validationRunId?: string;
  }): Promise<{ batchId: string; createdNames: string[]; serverId: string; behavior: string }> {
    const config = await this.configService.getById(params.serverId);
    if (!config) throw new NotFoundException(`Server config ${params.serverId} not found`);

    if (config.serverType !== 'external') {
      const state = this.processManager.getState(params.serverId);
      if (state !== 'RUNNING') {
        throw new BadRequestException(`Server ${params.serverId} is not running (current: ${state})`);
      }
    }

    // Resolve Minecraft protocol version from ping data (e.g. "Paper 1.20.1" → "1.20.1")
    let serverVersion: string | undefined;
    const serverDto = await this.multiServer.getServer(params.serverId);
    if (serverDto?.version) {
      const versionMatch = serverDto.version.match(/(\d+\.\d+(?:\.\d+)?)/);
      serverVersion = versionMatch?.[1];
    }

    const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createdNames = this.buildBotNames(params.namePrefix, params.count);

    const configs = createdNames.map((name) => ({
      name,
      serverHost: config.host,
      serverPort: config.port,
    }));

    const chunks = this.chunk(configs, MAX_BOTS_PER_WORKER);
    for (const chunk of chunks) {
      const worker = this.pool.spawn(
        (pid, msg) => this.handleWorkerMessage(pid, msg),
        (pid) => this.handleWorkerExit(pid),
      );
      const pid = worker.pid!;

      for (const cfg of chunk) {
        const assignment = {
          name: cfg.name,
          workerPid: pid,
          serverId: params.serverId,
          batchId,
          savedConfigId: params.savedConfigId,
          validationRunId: params.validationRunId,
        } satisfies BotAssignment;
        this.assignments.set(cfg.name, assignment);
        this.recentAssignments.delete(cfg.name);
      }

      this.pool.sendTo(pid, {
        type: IpcCommand.CREATE_BOTS,
        payload: {
          serverHost: chunk[0].serverHost,
          serverPort: chunk[0].serverPort,
          serverVersion,
          names: chunk.map((c) => c.name),
          connectTimeoutMs: 30_000,
          reconnectEnabled: true,
          reconnectMaxRetries: params.reconnectMaxRetries ?? 5,
          behaviorTemplate: params.behavior,
          autoRespawn: params.autoRespawn ?? true,
        },
      });
    }

    return { batchId, createdNames, serverId: params.serverId, behavior: params.behavior };
  }

  setBehavior(botName: string, behavior: string, params: Record<string, unknown>): boolean {
    const assignment = this.assignments.get(botName);
    if (!assignment) return false;
    return this.pool.sendTo(assignment.workerPid, {
      type: IpcCommand.SET_BEHAVIOR,
      payload: { botName, behaviorName: behavior, params },
    });
  }

  stopBots(names: string[]): void {
    const byWorker = new Map<number, string[]>();
    for (const name of names) {
      const assignment = this.assignments.get(name);
      if (!assignment) continue;
      const list = byWorker.get(assignment.workerPid) ?? [];
      list.push(name);
      byWorker.set(assignment.workerPid, list);
    }

    for (const [pid, botNames] of byWorker) {
      this.pool.sendTo(pid, {
        type: IpcCommand.STOP_BOTS,
        payload: { names: botNames },
      });
      for (const n of botNames) {
        const assignment = this.assignments.get(n);
        if (assignment) {
          this.recentAssignments.set(n, assignment);
        }
        this.assignments.delete(n);
      }

      // If this worker has no remaining bot assignments, shut it down
      const remaining = [...this.assignments.values()].filter((a) => a.workerPid === pid);
      if (remaining.length === 0) {
        this.pool.kill(pid);
        this.botState.removeWorker(pid);
      }
    }
  }

  stopBatch(batchId: string): void {
    const names = [...this.assignments.values()]
      .filter((a) => a.batchId === batchId)
      .map((a) => a.name);
    this.stopBots(names);
  }

  stopByServer(serverId: string): void {
    const names = [...this.assignments.values()]
      .filter((a) => a.serverId === serverId)
      .map((a) => a.name);
    this.stopBots(names);
  }

  reconnectBot(name: string): boolean {
    const assignment = this.assignments.get(name);
    if (!assignment) return false;
    return this.pool.sendTo(assignment.workerPid, {
      type: IpcCommand.RECONNECT_BOTS,
      payload: { names: [name] },
    });
  }

  getStats(serverId?: string): { total: number; online: number; offline: number; error: number } {
    let bots = this.enrichedBots();
    if (serverId) {
      bots = bots.filter((b) => b.serverId === serverId);
    }
    return {
      total: bots.length,
      online: bots.filter((b) => b.state === 'online' || b.state === 'SPAWNED').length,
      offline: bots.filter((b) => b.state === 'offline' || b.state === 'DISCONNECTED').length,
      error: bots.filter((b) => b.state === 'error' || b.state === 'ERROR').length,
    };
  }

  enrichedBots() {
    return this.botState.allBots().map((b) => {
      const assignment = this.assignments.get(b.name);
      return {
        ...b,
        serverId: assignment?.serverId,
        batchId: assignment?.batchId,
        savedConfigId: assignment?.savedConfigId,
        validationRunId: assignment?.validationRunId,
      };
    });
  }

  async getBotDetail(botName: string): Promise<{ inventory: readonly BotInventoryItem[]; nearbyEntities: readonly BotNearbyEntity[]; terrain: readonly BotTerrainBlock[] }> {
    const assignment = this.assignments.get(botName);
    if (!assignment) return { inventory: [], nearbyEntities: [], terrain: [] };

    const requestId = `detail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingDetailRequests.delete(requestId);
        resolve({ inventory: [], nearbyEntities: [], terrain: [] });
      }, 5000);

      this.pendingDetailRequests.set(requestId, (payload) => {
        clearTimeout(timeout);
        this.pendingDetailRequests.delete(requestId);
        resolve({ inventory: payload.inventory, nearbyEntities: payload.nearbyEntities, terrain: payload.terrain });
      });

      this.pool.sendTo(assignment.workerPid, {
        type: IpcCommand.GET_BOT_DETAIL,
        requestId,
        payload: { botName },
      });
    });
  }

  stopAll(): void {
    const pids = this.pool.pids();
    // Send graceful shutdown via IPC first, then force-kill all workers
    this.pool.broadcast({ type: IpcCommand.SHUTDOWN, payload: {} });
    this.pool.killAll();
    this.assignments.clear();
    for (const pid of pids) {
      this.botState.removeWorker(pid);
    }
  }

  onModuleDestroy(): void {
    this.logger.log('Server shutting down — cleaning up all workers');
    this.pool.killAll();
    this.assignments.clear();
  }

  getWorkerPid(botName: string): number | undefined {
    return this.assignments.get(botName)?.workerPid;
  }

  startDebug(botName: string): boolean {
    const assignment = this.assignments.get(botName);
    if (!assignment) return false;
    return this.pool.sendTo(assignment.workerPid, {
      type: IpcCommand.DEBUG_START,
      payload: { botName },
    });
  }

  sendDebugCommand(botName: string, command: string): boolean {
    const assignment = this.assignments.get(botName);
    if (!assignment) return false;
    return this.pool.sendTo(assignment.workerPid, {
      type: IpcCommand.DEBUG_COMMAND,
      payload: { botName, command },
    });
  }

  stopDebug(botName: string): boolean {
    const assignment = this.assignments.get(botName);
    if (!assignment) return false;
    return this.pool.sendTo(assignment.workerPid, {
      type: IpcCommand.DEBUG_STOP,
      payload: { botName },
    });
  }

  forceRespawn(botName: string): boolean {
    const assignment = this.assignments.get(botName);
    if (!assignment) return false;
    return this.pool.sendTo(assignment.workerPid, {
      type: IpcCommand.FORCE_RESPAWN,
      payload: { botName },
    });
  }

  executeScript(botName: string, script: BotScript): boolean {
    const assignment = this.assignments.get(botName);
    if (!assignment) return false;
    return this.pool.sendTo(assignment.workerPid, {
      type: IpcCommand.EXECUTE_SCRIPT,
      payload: { botName, script },
    });
  }

  private handleWorkerMessage(pid: number, msg: IpcMessage<unknown>): void {
    this.logger.debug(`Worker ${pid} message: ${msg.type}`);
    switch (msg.type) {
      case IpcEvent.STATE_REPORT:
        this.botState.absorb(pid, msg.payload as StateReportPayload);
        break;
      case IpcEvent.WORKER_READY:
        this.logger.log(`Worker ${pid} ready`);
        break;
      case IpcEvent.WORKER_ERROR:
        this.logger.error(`Worker ${pid} reported error: ${JSON.stringify(msg.payload)}`);
        break;
      case IpcEvent.DEBUG_OUTPUT: {
        const debugPayload = msg.payload as { botName: string; output: string };
        this.botRealtime.pushDebugOutput(debugPayload.botName, debugPayload.output);
        break;
      }
      case IpcEvent.BOT_DETAIL_RESPONSE: {
        const detailPayload = msg.payload as BotDetailResponsePayload;
        const cb = this.pendingDetailRequests.get(detailPayload.requestId);
        if (cb) cb(detailPayload);
        break;
      }
      case IpcEvent.CHAT_MESSAGE: {
        const chatPayload = msg.payload as ChatMessagePayload;
        const assignment = this.assignments.get(chatPayload.botName) ?? this.recentAssignments.get(chatPayload.botName);
        this.botRealtime.pushChatMessage({
          botName: chatPayload.botName,
          message: chatPayload.message,
          timestamp: chatPayload.timestamp,
          serverId: assignment?.serverId,
          batchId: assignment?.batchId,
          validationRunId: assignment?.validationRunId,
        });
        break;
      }
      case IpcEvent.EVENT_REPORT: {
        const reportPayload = msg.payload as EventReportPayload;
        for (const event of reportPayload.events) {
          const assignment = this.assignments.get(event.botName) ?? this.recentAssignments.get(event.botName);
          this.botRealtime.pushBotEvent({
            ...event,
            serverId: assignment?.serverId,
            batchId: assignment?.batchId,
            validationRunId: assignment?.validationRunId,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  private handleWorkerExit(pid: number): void {
    this.botState.removeWorker(pid);
    for (const [name, assignment] of this.assignments) {
      if (assignment.workerPid === pid) {
        this.assignments.delete(name);
      }
    }
    for (const [name, assignment] of this.recentAssignments) {
      if (assignment.workerPid === pid) {
        this.recentAssignments.delete(name);
      }
    }
    this.logger.log(`Cleaned up state for worker ${pid}`);
  }

  private chunk<T>(arr: ReadonlyArray<T>, size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size) as T[]);
    }
    return result;
  }

  private buildBotNames(namePrefix: string, count: number): string[] {
    const basePrefix = namePrefix.trim() || 'bot';
    const names: string[] = [];

    for (let index = 0; index < count; index += 1) {
      const suffix = `-${index + 1}`;
      const maxPrefixLength = Math.max(1, MAX_MINECRAFT_USERNAME_LENGTH - suffix.length);
      names.push(`${basePrefix.slice(0, maxPrefixLength)}${suffix}`);
    }

    return names;
  }
}
