import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { connect } from 'node:net';

const DEFAULT_READY_PATTERN = /Done \(.+?\)! For help, type "help"/;

type ReadyMode = 'output' | 'port' | 'hybrid';

interface ReadyWaiter {
  readonly serverId: string;
  readonly pattern: RegExp;
  readonly mode: ReadyMode;
  readonly host?: string;
  readonly port?: number;
  readonly timeoutMs: number;
  readonly timeout: ReturnType<typeof setTimeout>;
  readonly portProbeTimeoutMs: number;
  readonly portCheckIntervalMs: number;
  readonly resolve: (result: { ready: boolean; durationMs: number; timedOut: boolean }) => void;
  readonly startTime: number;
  resolved: boolean;
  intervalId?: ReturnType<typeof setInterval>;
}

export interface ReadyWaiterOptions {
  readonly mode?: ReadyMode;
  readonly host?: string;
  readonly port?: number;
  readonly portCheckTimeoutMs?: number;
  readonly portCheckIntervalMs?: number;
}

@Injectable()
export class StartReadyDetector {
  private readonly logger = new Logger(StartReadyDetector.name);
  private readonly waiters = new Map<string, ReadyWaiter>();

  waitForReady(
    serverId: string,
    customPattern: string | undefined,
    timeoutMs: number,
    options: ReadyWaiterOptions = {},
  ): Promise<{ ready: boolean; durationMs: number; timedOut: boolean }> {
    const mode: ReadyMode = options.mode ?? 'hybrid';
    const host = options.host?.trim();
    const port = options.port;
    const portProbeTimeoutMs = options.portCheckTimeoutMs ?? 5_000;
    const portCheckIntervalMs = options.portCheckIntervalMs ?? 500;

    let pattern = DEFAULT_READY_PATTERN;
    if (customPattern) {
      try {
        pattern = new RegExp(customPattern);
      } catch (err) {
        this.logger.warn(`Invalid ready pattern for ${serverId}, fallback to default: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return new Promise((resolve) => {
      const waiter: ReadyWaiter = {
        serverId,
        pattern,
        mode,
        host,
        port,
        timeoutMs,
        startTime: Date.now(),
        resolved: false,
        resolve,
        timeout: setTimeout(() => {
          this.finalizeWait(serverId, false, Date.now() - waiter.startTime, true);
        }, timeoutMs),
        portProbeTimeoutMs: Math.min(portProbeTimeoutMs, timeoutMs),
        portCheckIntervalMs,
      };

      this.waiters.set(serverId, waiter);

      if (mode === 'port' || mode === 'hybrid') {
        this.schedulePortProbe(waiter);
      }
    });
  }

  private schedulePortProbe(waiter: ReadyWaiter): void {
    const { serverId, host, port, resolved } = waiter;
    if (!host || !port || port <= 0 || Number.isNaN(port) || resolved) {
      return;
    }

    const deadline = Date.now() + waiter.portProbeTimeoutMs;
    const intervalMs = Math.max(200, waiter.portCheckIntervalMs);
    let inFlight = false;

    const checkOnce = async () => {
      const current = this.waiters.get(serverId);
      if (!current || current.resolved) return;
      if (Date.now() >= deadline) return;
      if (inFlight) return;
      inFlight = true;
      try {
        const timeout = Math.max(150, deadline - Date.now());
        const ok = await this.checkPortOpen(host, port, Math.min(1_000, timeout));
        if (ok) {
          this.finalizeWait(serverId, true, Date.now() - waiter.startTime, false);
        }
      } finally {
        inFlight = false;
      }
    };

    void checkOnce();
    waiter.intervalId = setInterval(() => {
      void checkOnce();
    }, intervalMs);
  }

  private checkPortOpen(host: string, port: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = connect({ host, port, timeout: Math.max(100, timeoutMs) }, () => {
        socket.end();
        resolve(true);
      });

      const close = () => {
        if (!socket.destroyed) {
          socket.destroy();
        }
      };

      socket.on('error', () => {
        close();
        resolve(false);
      });
      socket.on('timeout', () => {
        close();
        resolve(false);
      });
    });
  }

  private finalizeWait(serverId: string, ready: boolean, durationMs: number, timedOut: boolean): void {
    const waiter = this.waiters.get(serverId);
    if (!waiter || waiter.resolved) return;

    waiter.resolved = true;
    if (waiter.intervalId !== undefined) {
      clearInterval(waiter.intervalId);
    }
    clearTimeout(waiter.timeout);
    this.waiters.delete(serverId);

    if (ready) {
      this.logger.log(`Server ${serverId} ready after ${durationMs}ms`);
    } else {
      this.logger.warn(`Ready detection timed out for ${serverId}`);
    }

    waiter.resolve({ ready, durationMs, timedOut });
  }

  onOutput(serverId: string, chunk: string): void {
    const waiter = this.waiters.get(serverId);
    if (!waiter || waiter.resolved || !this.isOutputMode(waiter)) return;

    if (waiter.pattern.test(chunk)) {
      this.finalizeWait(serverId, true, Date.now() - waiter.startTime, false);
    }
  }

  @OnEvent('server.output')
  handleServerOutput(event: { serverId: string; chunk: string }): void {
    this.onOutput(event.serverId, event.chunk);
  }

  cancel(serverId: string): void {
    const waiter = this.waiters.get(serverId);
    if (!waiter || waiter.resolved) return;

    waiter.resolved = true;
    if (waiter.intervalId !== undefined) {
      clearInterval(waiter.intervalId);
    }
    clearTimeout(waiter.timeout);
    this.waiters.delete(serverId);
  }

  private isOutputMode(waiter: ReadyWaiter): boolean {
    return waiter.mode === 'output' || waiter.mode === 'hybrid';
  }
}
