import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ServerState } from '@jian-agent/shared-domain';
import type { ServerConfig } from '@jian-agent/shared-domain';
import type { ServerStatusPayload } from '@jian-agent/shared-protocol';
import type { JavaRuntimeSelectionDto } from '@jian-agent/shared-domain';
import type {
  ServerOutputEvent,
  ServerStateChangedEvent,
  ServerCrashedEvent,
} from '../event-bus/events.js';
import { ProbeInjectorService } from './probe-injector.service.js';
import { TerminalSessionService } from '../terminal-session/terminal-session.service.js';
import { SessionType } from '../terminal-session/terminal-session.types.js';
import type { UnifiedTerminalSession } from '../terminal-session/terminal-session.service.js';
import { JavaRuntimeService } from '../java-runtime/java-runtime.service.js';
import * as iconv from 'iconv-lite';
import { readStartReadyConfig } from '../common/network-config.js';

/** Detect Windows system encoding (GBK/CP936 for CJK systems) */
const IS_WINDOWS = process.platform === 'win32';
const SYSTEM_ENCODING = IS_WINDOWS ? 'gbk' : 'utf-8';

/** Max output lines kept in memory per server */
const OUTPUT_BUFFER_SIZE = 2000;

interface ManagedProcess {
  readonly serverId: string;
  state: ServerState;
  process: ChildProcess | null;
  pid: number | undefined;
  startTime: number | undefined;
  lastExitCode: number | undefined;
  lastExitTime: string | undefined;
  restartCount: number;
  mcSession: UnifiedTerminalSession | null;
}

@Injectable()
export class ProcessManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(ProcessManagerService.name);
  private readonly processes = new Map<string, ManagedProcess>();
  private readonly stopLocks = new Map<string, Promise<void>>();
  /** Ring buffer per server for recent output lines */
  private readonly outputBuffers = new Map<string, string[]>();

  constructor(
    private readonly eventBus: EventEmitter2,
    private readonly probeInjector: ProbeInjectorService,
    private readonly terminalSessionService: TerminalSessionService,
    private readonly javaRuntimeService: JavaRuntimeService,
  ) {}

  onModuleDestroy(): void {
    for (const serverId of this.processes.keys()) {
      const managed = this.processes.get(serverId);
      if (!managed) continue;

      if (managed.process) {
        void this.stop(serverId, true);
      } else {
        this.closeTerminalSession(managed, managed.lastExitCode);
      }
    }
  }

  /** Backwards-compatible: get state for a server (default = 'default') */
  getState(serverId = 'default'): ServerState {
    return this.processes.get(serverId)?.state ?? ServerState.STOPPED;
  }

  /** Backwards-compatible: get status for a server (default = 'default') */
  getStatus(serverId = 'default'): ServerStatusPayload {
    const m = this.processes.get(serverId);
    const stubRef = { id: serverId, kind: 'SERVER' as const, name: serverId };
    const stubSummary = { id: serverId, kind: 'SERVER' as const, name: serverId, status: m?.state ?? ServerState.STOPPED, statusDetail: null, hostType: 'local' as const, host: null, port: null, tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    if (!m) {
      return { resourceRef: stubRef, resourceSummary: { ...stubSummary, status: ServerState.STOPPED }, state: ServerState.STOPPED, pid: undefined, uptime: undefined, lastExitCode: undefined, lastExitTime: undefined, restartCount: 0 };
    }
    return {
      resourceRef: stubRef,
      resourceSummary: { ...stubSummary, status: m.state },
      state: m.state,
      pid: m.pid,
      uptime: m.startTime ? Date.now() - m.startTime : undefined,
      lastExitCode: m.lastExitCode,
      lastExitTime: m.lastExitTime,
      restartCount: m.restartCount,
    };
  }

  /** Get all managed server IDs */
  getManagedServerIds(): readonly string[] {
    return [...this.processes.keys()];
  }

  /** Get state for all active processes */
  getAllStatuses(): ReadonlyMap<string, ServerStatusPayload> {
    const result = new Map<string, ServerStatusPayload>();
    for (const [id] of this.processes) {
      result.set(id, this.getStatus(id));
    }
    return result;
  }

  /** Get recent buffered output for a server */
  getOutputBuffer(serverId: string): readonly string[] {
    return this.outputBuffers.get(serverId) ?? [];
  }

  /** Push output chunk to ring buffer */
  private pushToBuffer(serverId: string, chunk: string): void {
    let buf = this.outputBuffers.get(serverId);
    if (!buf) {
      buf = [];
      this.outputBuffers.set(serverId, buf);
    }
    buf.push(chunk);
    // Trim to keep buffer size bounded
    if (buf.length > OUTPUT_BUFFER_SIZE) {
      buf.splice(0, buf.length - OUTPUT_BUFFER_SIZE);
    }
  }

  private createPendingManagedProcess(serverId: string, existing?: ManagedProcess): ManagedProcess {
    if (existing) {
      return {
        ...existing,
        state: ServerState.PENDING,
      };
    }

    return {
      serverId,
      state: ServerState.PENDING,
      process: null,
      pid: undefined,
      startTime: undefined,
      lastExitCode: undefined,
      lastExitTime: undefined,
      restartCount: 0,
      mcSession: null,
    };
  }

  async start(config: ServerConfig, serverId?: string): Promise<void> {
    const sid = serverId ?? config.id ?? 'default';

    if (!config || (!config.javaPath && !config.runtimeId) || !config.jarPath) {
      throw new Error('Invalid server configuration: javaPath (or runtimeId) and jarPath are required');
    }

    const existing = this.processes.get(sid);
    this.recoverOrphanedProcess(existing);
    if (existing && (existing.state === ServerState.RUNNING || existing.state === ServerState.STARTING || existing.state === ServerState.PENDING || existing.state === ServerState.STOPPING)) {
      throw new Error(`Cannot start server ${sid}: already ${existing.state}`);
    }

    const managed = this.createPendingManagedProcess(sid, existing);

    if (managed.mcSession) {
      this.closeTerminalSession(managed, managed.lastExitCode);
    }
    this.processes.set(sid, managed);
    this.setManagedState(managed, ServerState.PENDING);
    this.setManagedState(managed, ServerState.STARTING);

    // Create unified MC console session
    const mcSession = this.terminalSessionService.create({
      type: SessionType.MC_CONSOLE,
      serverId: sid,
      sessionId: `mc:${sid}`,
    });
    managed.mcSession = mcSession;

    // Wire MC console session input → process stdin
    mcSession.on('input', (command: string) => {
      const normalized = command.replace(/\r\n?/g, '\n');
      try {
        this.writeStdin(sid, normalized);
      } catch (err) {
        this.logger.warn(`Cannot write to server ${sid}: process not running`, err);
      }
    });

    // Wire MC console session resize
    mcSession.on('resize', (_cols: number, _rows: number) => {
      // MC console does not support resize, no-op
    });

    mcSession.activate();

    // Inject probe plugin before starting the server
    try {
      await this.probeInjector.inject(config.workDir, sid);
    } catch (err: unknown) {
      this.logger.warn(`Probe injection failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
    }

    const args = [...config.jvmArgs, '-jar', config.jarPath, ...config.serverArgs];
    const env = { ...process.env, ...config.envVars };

    // Auto-create workDir if it doesn't exist
    try {
      await import('fs/promises').then(fs => fs.mkdir(config.workDir, { recursive: true }));
    } catch (err: unknown) {
      this.logger.warn(`Could not create workDir ${config.workDir}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Resolve actual Java path: prefer runtimeId, fallback to config.javaPath
    let javaPath = config.javaPath || 'java';
    try {
      const selection: JavaRuntimeSelectionDto = await this.javaRuntimeService.resolveJavaPath(config.runtimeId || undefined);
      if (selection.resolvedJavaPath) {
        javaPath = selection.resolvedJavaPath;
      }
    } catch (err) {
      this.logger.warn(`Failed to resolve runtimeId ${config.runtimeId}, falling back to javaPath`, err);
    }

    let child: ChildProcess;
    try {
      child = spawn(javaPath, args, {
        cwd: config.workDir,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err: unknown) {
      this.logger.error(`Server ${sid} failed to spawn process: ${err instanceof Error ? err.message : String(err)}`);
      this.setManagedState(managed, ServerState.STOPPED);
      this.closeTerminalSession(managed, managed.lastExitCode);
      throw err;
    }

    managed.process = child;
    managed.pid = child.pid;
    managed.startTime = Date.now();

    child.on('spawn', () => {
      this.setManagedState(managed, ServerState.RUNNING);
      this.logger.log(`Server ${sid} started with PID ${managed.pid}`);
    });

    child.on('error', (err: Error) => {
      this.logger.error(`Server ${sid} process error: ${err.message}`);
      this.setManagedState(managed, ServerState.CRASHED);
    });

    child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      managed.lastExitCode = code ?? undefined;
      managed.lastExitTime = new Date().toISOString();
      managed.pid = undefined;
      managed.process = null;

      // Close MC console session
      if (managed.mcSession) {
        managed.mcSession.emitExit({ exitCode: code ?? 0 });
        this.terminalSessionService.close(managed.mcSession.sessionId);
        managed.mcSession = null;
      }

      if (managed.state === ServerState.STOPPING) {
        this.setManagedState(managed, ServerState.STOPPED);
      } else {
        this.setManagedState(managed, ServerState.CRASHED);
        const crashEvent: ServerCrashedEvent = {
          serverId: managed.serverId,
          exitCode: code ?? undefined,
          signal: signal ?? undefined,
          timestamp: Date.now(),
        };
        this.eventBus.emit('server.crashed', crashEvent);
      }
      this.logger.log(`Server ${sid} exited: code=${code} signal=${signal}`);
    });

    child.stdout?.on('data', (data: Buffer) => {
      const chunk = iconv.decode(data, SYSTEM_ENCODING);
      this.pushToBuffer(sid, chunk);
      const event: ServerOutputEvent = {
        serverId: sid,
        stream: 'stdout',
        chunk,
        timestamp: Date.now(),
      };
      this.eventBus.emit('server.output', event);
      // Also emit directly to MC console session for subscribers
      managed.mcSession?.emitOutput(chunk);
    });

    child.stderr?.on('data', (data: Buffer) => {
      const chunk = iconv.decode(data, SYSTEM_ENCODING);
      this.pushToBuffer(sid, chunk);
      const event: ServerOutputEvent = {
        serverId: sid,
        stream: 'stderr',
        chunk,
        timestamp: Date.now(),
      };
      this.eventBus.emit('server.output', event);
      // Also emit directly to MC console session for subscribers
      managed.mcSession?.emitOutput(chunk);
    });
  }

  async stop(forceOrServerId?: boolean | string, force = false): Promise<void> {
    let sid: string;
    let forceKill: boolean;

    if (typeof forceOrServerId === 'string') {
      sid = forceOrServerId;
      forceKill = force;
    } else {
      sid = 'default';
      forceKill = forceOrServerId ?? false;
    }

    const previous = (this.stopLocks.get(sid) ?? Promise.resolve()).catch(() => undefined);
    const current = previous.then(() => this.stopUnsafe(sid, forceKill));
    this.stopLocks.set(sid, current.finally(() => {
      if (this.stopLocks.get(sid) === current) {
        this.stopLocks.delete(sid);
      }
    }));
    return current;
  }

  private async stopUnsafe(serverId: string, forceKill: boolean): Promise<void> {
    const managed = this.processes.get(serverId);
    if (!managed) {
      this.logger.warn(`No server process to stop for ${serverId}`);
      return;
    }

    if (!managed.process) {
      if (managed.state !== ServerState.STOPPED && managed.state !== ServerState.CRASHED) {
        this.setManagedState(managed, ServerState.STOPPED);
      }
      this.closeTerminalSession(managed, managed.lastExitCode);
      return;
    }

    if (managed.state === ServerState.STOPPING) {
      const stopped = await this.awaitProcessStop(serverId, managed, readStartReadyConfig().stopTimeoutMs);
      if (!stopped) {
        throw new Error(`Stop for ${serverId} timed out`);
      }
      return;
    }

    this.setManagedState(managed, ServerState.STOPPING);

    if (forceKill) {
      managed.process.kill('SIGKILL');
    } else {
      if (managed.process.stdin && managed.process.stdin.writable) {
        managed.process.stdin.write('stop\n');
      } else {
        managed.process.kill('SIGKILL');
      }
    }

    const stopTimeoutMs = readStartReadyConfig().stopTimeoutMs;
    const stopped = await this.awaitProcessStop(serverId, managed, stopTimeoutMs);
    if (stopped) {
      return;
    }

    if (!forceKill) {
      this.logger.warn(`Server ${serverId}: graceful stop timed out, force killing`);
      managed.process.kill('SIGKILL');
      const forceStopped = await this.awaitProcessStop(
        serverId,
        managed,
        Math.max(5_000, Math.min(stopTimeoutMs, 5_000)),
      );
      if (forceStopped) {
        return;
      }
    }

    this.recoverOrphanedProcess(managed);
    this.closeTerminalSession(managed, managed.lastExitCode);
    this.setManagedState(managed, ServerState.STOPPED);
    throw new Error(`Stop for ${serverId} timed out`);
  }

  private recoverOrphanedProcess(managed: ManagedProcess | undefined): void {
    if (!managed) return;
    if (!managed.process) {
      if (
        managed.state !== ServerState.STOPPED
        && managed.state !== ServerState.CRASHED
      ) {
        this.setManagedState(managed, ServerState.STOPPED);
      }
      return;
    }

    if (managed.process.killed) {
      managed.process = null;
      managed.pid = undefined;
      managed.startTime = undefined;
      this.setManagedState(managed, ServerState.STOPPED);
      return;
    }
  }

  async restart(config: ServerConfig, serverId?: string): Promise<void> {
    const sid = serverId ?? config.id ?? 'default';
    const managed = this.processes.get(sid);

    if (managed?.process) {
      await this.stop(sid);
      await new Promise<void>((resolve) => {
        const check = () => {
          const m = this.processes.get(sid);
          if (!m || m.state === ServerState.STOPPED || m.state === ServerState.CRASHED) {
            resolve();
          } else {
            setTimeout(check, 500);
          }
        };
        check();
      });
    }

    const m = this.processes.get(sid);
    if (m) m.restartCount++;
    await this.start(config, sid);
  }

  writeStdin(serverId: string, command: string): void {
    const managed = this.processes.get(serverId);
    if (!managed?.process?.stdin) {
      throw new Error(`Cannot write to server ${serverId}: no active process or stdin unavailable`);
    }
    managed.process.stdin.write(command);
  }

  private setManagedState(managed: ManagedProcess, newState: ServerState): void {
    if (managed.state === newState) return;

    const prev = managed.state;
    managed.state = newState;
    const event: ServerStateChangedEvent = {
      serverId: managed.serverId,
      oldState: prev,
      newState,
      pid: managed.pid,
      timestamp: Date.now(),
    };
    this.eventBus.emit('server.state-changed', event);
  }

  private async stopWithTimeout(
    managed: ManagedProcess,
    stopTimeoutMs: number,
  ): Promise<boolean> {
    const deadline = Date.now() + stopTimeoutMs;
    while (Date.now() < deadline) {
      if (!managed.process || managed.state === ServerState.STOPPED || managed.state === ServerState.CRASHED) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return !managed.process || managed.state === ServerState.STOPPED || managed.state === ServerState.CRASHED;
  }

  private async awaitProcessStop(serverId: string, managed: ManagedProcess, stopTimeoutMs: number): Promise<boolean> {
    const stopped = await this.stopWithTimeout(managed, stopTimeoutMs);
    if (!stopped && managed.process) {
      const stillAlive = !managed.process.killed;
      if (!stillAlive) {
        return true;
      }
      this.logger.warn(`Server ${serverId} still running after stop wait window`);
    }
    return stopped;
  }

  private closeTerminalSession(managed: ManagedProcess, exitCode?: number): void {
    if (!managed.mcSession) {
      return;
    }

    managed.mcSession.emitExit({ exitCode: exitCode ?? 0 });
    this.terminalSessionService.close(managed.mcSession.sessionId);
    managed.mcSession = null;
  }
}
