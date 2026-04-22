import { Injectable, Logger } from '@nestjs/common';
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
export class ProcessManagerService {
  private readonly logger = new Logger(ProcessManagerService.name);
  private readonly processes = new Map<string, ManagedProcess>();
  /** Ring buffer per server for recent output lines */
  private readonly outputBuffers = new Map<string, string[]>();

  constructor(
    private readonly eventBus: EventEmitter2,
    private readonly probeInjector: ProbeInjectorService,
    private readonly terminalSessionService: TerminalSessionService,
    private readonly javaRuntimeService: JavaRuntimeService,
  ) {}

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

  async start(config: ServerConfig, serverId?: string): Promise<void> {
    const sid = serverId ?? config.id ?? 'default';

    if (!config || (!config.javaPath && !config.runtimeId) || !config.jarPath) {
      throw new Error('Invalid server configuration: javaPath (or runtimeId) and jarPath are required');
    }

    const existing = this.processes.get(sid);
    if (existing && (existing.state === ServerState.RUNNING || existing.state === ServerState.STARTING)) {
      throw new Error(`Cannot start server ${sid}: already ${existing.state}`);
    }

    const managed: ManagedProcess = {
      serverId: sid,
      state: ServerState.STARTING,
      process: null,
      pid: undefined,
      startTime: undefined,
      lastExitCode: existing?.lastExitCode,
      lastExitTime: existing?.lastExitTime,
      restartCount: existing?.restartCount ?? 0,
      mcSession: null,
    };
    this.processes.set(sid, managed);
    this.emitState(managed, ServerState.STARTING);

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
      } catch {
        this.logger.warn(`Cannot write to server ${sid}: process not running`);
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
    } catch (err: any) {
      this.logger.warn(`Probe injection failed (non-fatal): ${err.message}`);
    }

    const args = [...config.jvmArgs, '-jar', config.jarPath, ...config.serverArgs];
    const env = { ...process.env, ...config.envVars };

    // Auto-create workDir if it doesn't exist
    try {
      await import('fs/promises').then(fs => fs.mkdir(config.workDir, { recursive: true }));
    } catch (err: any) {
      this.logger.warn(`Could not create workDir ${config.workDir}: ${err.message}`);
    }

    // Resolve actual Java path: prefer runtimeId, fallback to config.javaPath
    let javaPath = config.javaPath || 'java';
    try {
      const selection: JavaRuntimeSelectionDto = await this.javaRuntimeService.resolveJavaPath(config.runtimeId || undefined);
      if (selection.resolvedJavaPath) {
        javaPath = selection.resolvedJavaPath;
      }
    } catch {
      this.logger.warn(`Failed to resolve runtimeId ${config.runtimeId}, falling back to javaPath`);
    }

    const child: ChildProcess = spawn(javaPath, args, {
      cwd: config.workDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

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

    const managed = this.processes.get(sid);
    if (!managed?.process) {
      throw new Error(`No server process to stop for ${sid}`);
    }

    this.setManagedState(managed, ServerState.STOPPING);

    if (forceKill) {
      managed.process.kill('SIGKILL');
    } else {
      managed.process.stdin?.write('stop\n');
      setTimeout(() => {
        if (managed.process && managed.state === ServerState.STOPPING) {
          this.logger.warn(`Server ${sid}: graceful stop timed out, force killing`);
          managed.process.kill('SIGKILL');
        }
      }, 30000);
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

  private emitState(managed: ManagedProcess, state: ServerState): void {
    managed.state = state;
    const event: ServerStateChangedEvent = {
      serverId: managed.serverId,
      oldState: ServerState.STOPPED,
      newState: state,
      pid: managed.pid,
      timestamp: Date.now(),
    };
    this.eventBus.emit('server.state-changed', event);
  }
}
