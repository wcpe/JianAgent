import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../storage/drizzle.provider.js';
import { restartHistory } from '../storage/schema.js';

interface RestartState {
  readonly count: number;
  readonly lastAttempt: number;
}

const COOLDOWN_MS = 60_000;

@Injectable()
export class CrashRestartService {
  private readonly logger = new Logger(CrashRestartService.name);
  private readonly restartStates = new Map<string, RestartState>();
  private readonly lastSuccessfulRestart = new Map<string, number>();
  private readonly BACKOFF_BASE = 1000;
  private readonly BACKOFF_MAX = 30_000;

  private startCallback: ((serverId: string) => Promise<void>) | null = null;

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
  ) {}

  setStartCallback(cb: (serverId: string) => Promise<void>): void {
    this.startCallback = cb;
  }

  async handleCrash(
    serverId: string,
    exitCode: number | null,
    autoRestart: boolean,
    maxRestarts: number,
    signal?: string | null,
  ): Promise<{ willRestart: boolean; attempt: number; delay: number }> {
    if (!autoRestart) {
      return { willRestart: false, attempt: 0, delay: 0 };
    }

    // Graceful exit — no restart
    if (exitCode === 0) {
      this.resetCount(serverId);
      return { willRestart: false, attempt: 0, delay: 0 };
    }

    // Cooldown check
    const lastSuccess = this.lastSuccessfulRestart.get(serverId);
    if (lastSuccess && Date.now() - lastSuccess < COOLDOWN_MS) {
      this.logger.warn(`Server ${serverId} is in cooldown period (${COOLDOWN_MS}ms), skipping restart`);
      return { willRestart: false, attempt: 0, delay: 0 };
    }

    const current = this.restartStates.get(serverId);
    const count = (current?.count ?? 0) + 1;
    this.restartStates.set(serverId, { count, lastAttempt: Date.now() });

    if (count > maxRestarts) {
      this.logger.error(`Server ${serverId} exceeded max restarts (${maxRestarts})`);
      await this.recordRestart(serverId, exitCode, signal, 0, count, false);
      return { willRestart: false, attempt: count, delay: 0 };
    }

    const delay = Math.min(this.BACKOFF_BASE * Math.pow(2, count - 1), this.BACKOFF_MAX);
    this.logger.warn(`Auto-restarting server ${serverId} in ${delay}ms (attempt ${count}/${maxRestarts})`);

    setTimeout(async () => {
      try {
        await this.startCallback?.(serverId);
        this.recordSuccessfulRestart(serverId);
        await this.recordRestart(serverId, exitCode, signal, delay, count, true);
      } catch (err) {
        this.logger.error(`Auto-restart failed for ${serverId}: ${err}`);
        await this.recordRestart(serverId, exitCode, signal, delay, count, false);
      }
    }, delay);

    return { willRestart: true, attempt: count, delay };
  }

  resetCount(serverId: string): void {
    this.restartStates.delete(serverId);
  }

  getRestartCount(serverId: string): number {
    return this.restartStates.get(serverId)?.count ?? 0;
  }

  recordSuccessfulRestart(serverId: string): void {
    this.lastSuccessfulRestart.set(serverId, Date.now());
  }

  private async recordRestart(
    serverId: string,
    exitCode: number | null,
    signal: string | null | undefined,
    delayMs: number,
    attempt: number,
    success: boolean,
  ): Promise<void> {
    try {
      await this.db.insert(restartHistory).values({
        id: crypto.randomUUID(),
        serverId,
        timestamp: new Date().toISOString(),
        exitCode: exitCode ?? undefined,
        signal: signal ?? undefined,
        delayMs,
        attempt,
        success,
      });
    } catch (err) {
      this.logger.error(`Failed to record restart history for ${serverId}: ${err}`);
    }
  }

  async getRestartHistory(serverId: string, limit = 50): Promise<readonly unknown[]> {
    return this.db
      .select()
      .from(restartHistory)
      .where(eq(restartHistory.serverId, serverId))
      .orderBy(desc(restartHistory.timestamp))
      .limit(limit);
  }
}
