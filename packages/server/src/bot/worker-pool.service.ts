import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { fork, type ChildProcess } from 'child_process';
import { IpcCommand, IpcEvent, type IpcMessage } from '@jian-agent/shared-protocol';

interface LocalWorkerState {
  readonly pid: number;
  readonly lastHeartbeatAt: number;
  readonly lastPingAt: number | null;
  readonly ready: boolean;
  readonly stale: boolean;
}

interface WorkerEntry {
  readonly child: ChildProcess;
  lastHeartbeatAt: number;
  lastPingAt: number | null;
  ready: boolean;
  stale: boolean;
}

const HEARTBEAT_INTERVAL_MS = 10_000;
const HEARTBEAT_TIMEOUT_MS = 25_000;

@Injectable()
export class WorkerPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(WorkerPoolService.name);
  private readonly workers = new Map<number, WorkerEntry>();
  private readonly workerEntryPath = require.resolve('@jian-agent/bot-worker');
  private readonly heartbeatTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.heartbeatTimer = setInterval(() => this.heartbeatSweep(), HEARTBEAT_INTERVAL_MS);
    this.heartbeatTimer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.heartbeatTimer);
    this.killAll();
  }

  spawn(
    onMessage?: (pid: number, msg: IpcMessage<unknown>) => void,
    onExit?: (pid: number, code: number | null) => void,
  ): ChildProcess {
    const child = fork(this.workerEntryPath, [], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
    const pid = child.pid!;
    this.workers.set(pid, {
      child,
      lastHeartbeatAt: Date.now(),
      lastPingAt: null,
      ready: false,
      stale: false,
    });

    child.stdout?.on('data', (data: Buffer) => {
      this.logger.log(`Worker ${pid} stdout: ${data.toString().trim()}`);
    });

    child.stderr?.on('data', (data: Buffer) => {
      this.logger.error(`Worker ${pid} stderr: ${data.toString().trim()}`);
    });

    child.on('message', (msg: IpcMessage<unknown>) => {
      this.processInternalMessage(pid, msg);
      onMessage?.(pid, msg);
    });

    child.on('exit', (code) => {
      this.logger.warn(`Worker ${pid} exited with code ${code}`);
      this.workers.delete(pid);
      onExit?.(pid, code);
    });

    child.on('error', (err) => {
      this.logger.error(`Worker ${pid} error: ${err.message}`);
    });

    this.logger.log(`Spawned worker ${pid}`);
    return child;
  }

  sendTo(pid: number, msg: IpcMessage<unknown>): boolean {
    const entry = this.workers.get(pid);
    if (!entry?.child.connected) return false;
    entry.child.send(msg);
    return true;
  }

  broadcast(msg: IpcMessage<unknown>): void {
    for (const [, entry] of this.workers) {
      if (entry.child.connected) entry.child.send(msg);
    }
  }

  kill(pid: number): void {
    const entry = this.workers.get(pid);
    if (entry) {
      const child = entry.child;
      try {
        child.kill('SIGTERM');
      } catch { /* already dead */ }
      // Force-kill if still alive after 3 seconds
      const forceTimer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* already dead */ }
      }, 3000);
      forceTimer.unref();
      this.workers.delete(pid);
    }
  }

  killAll(): void {
    for (const pid of [...this.workers.keys()]) {
      this.kill(pid);
    }
  }

  size(): number {
    return this.workers.size;
  }

  pids(): number[] {
    return [...this.workers.keys()];
  }

  getWorkerState(pid: number): LocalWorkerState | undefined {
    const entry = this.workers.get(pid);
    if (!entry) {
      return undefined;
    }

    return {
      pid,
      lastHeartbeatAt: entry.lastHeartbeatAt,
      lastPingAt: entry.lastPingAt,
      ready: entry.ready,
      stale: entry.stale,
    };
  }

  listWorkerStates(): readonly LocalWorkerState[] {
    return [...this.workers.entries()].map(([pid, entry]) => ({
      pid,
      lastHeartbeatAt: entry.lastHeartbeatAt,
      lastPingAt: entry.lastPingAt,
      ready: entry.ready,
      stale: entry.stale,
    }));
  }

  private processInternalMessage(pid: number, msg: IpcMessage<unknown>): void {
    const entry = this.workers.get(pid);
    if (!entry) {
      return;
    }

    if (msg.type === IpcEvent.WORKER_READY || msg.type === IpcEvent.PONG) {
      entry.ready = true;
      entry.stale = false;
      entry.lastHeartbeatAt = Date.now();
    }
  }

  private heartbeatSweep(): void {
    const now = Date.now();

    for (const [pid, entry] of this.workers) {
      if (!entry.child.connected) {
        continue;
      }

      if (now - entry.lastHeartbeatAt > HEARTBEAT_TIMEOUT_MS) {
        entry.stale = true;
        this.logger.warn(`Worker ${pid} missed heartbeat window, recycling local worker`);
        this.kill(pid);
        continue;
      }

      entry.lastPingAt = now;
      entry.child.send({
        type: IpcCommand.PING,
        payload: { timestamp: now },
      });
    }
  }
}
