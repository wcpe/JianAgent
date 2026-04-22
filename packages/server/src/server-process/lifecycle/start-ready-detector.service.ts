import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

const DEFAULT_READY_PATTERN = /Done \(.+?\)! For help, type "help"/;

interface ReadyWaiter {
  readonly serverId: string;
  readonly pattern: RegExp;
  readonly timeout: ReturnType<typeof setTimeout>;
  readonly resolve: (result: { ready: boolean; durationMs: number; timedOut: boolean }) => void;
  readonly startTime: number;
}

@Injectable()
export class StartReadyDetector {
  private readonly logger = new Logger(StartReadyDetector.name);
  private readonly waiters = new Map<string, ReadyWaiter>();

  waitForReady(
    serverId: string,
    customPattern: string | undefined,
    timeoutMs: number,
  ): Promise<{ ready: boolean; durationMs: number; timedOut: boolean }> {
    return new Promise((resolve) => {
      const pattern = customPattern
        ? new RegExp(customPattern)
        : DEFAULT_READY_PATTERN;

      const timeout = setTimeout(() => {
        this.waiters.delete(serverId);
        this.logger.warn(`Ready detection timed out for ${serverId}`);
        resolve({ ready: false, durationMs: timeoutMs, timedOut: true });
      }, timeoutMs);

      this.waiters.set(serverId, {
        serverId,
        pattern,
        timeout,
        resolve,
        startTime: Date.now(),
      });
    });
  }

  onOutput(serverId: string, chunk: string): void {
    const waiter = this.waiters.get(serverId);
    if (!waiter) return;

    if (waiter.pattern.test(chunk)) {
      clearTimeout(waiter.timeout);
      this.waiters.delete(serverId);
      const durationMs = Date.now() - waiter.startTime;
      this.logger.log(`Server ${serverId} ready after ${durationMs}ms`);
      waiter.resolve({ ready: true, durationMs, timedOut: false });
    }
  }

  @OnEvent('server.output')
  handleServerOutput(event: { serverId: string; chunk: string }): void {
    this.onOutput(event.serverId, event.chunk);
  }

  cancel(serverId: string): void {
    const waiter = this.waiters.get(serverId);
    if (waiter) {
      clearTimeout(waiter.timeout);
      this.waiters.delete(serverId);
    }
  }
}
