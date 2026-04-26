import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { sessionTable } from '../db/schema/session.schema';
import { phaseRecordTable } from '../db/schema/phase-record.schema';
import { randomUUID } from 'crypto';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import type { DrizzleDb } from '../storage/drizzle.provider.js';

interface CreateSessionInput {
  readonly name: string;
  readonly serverId: string;
  readonly botConfigId: string;
  readonly phases: ReadonlyArray<{
    phase: string;
    botCount: number;
    behavior: string;
    durationSec: number;
  }>;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  async create(input: CreateSessionInput) {
    const id = `sess_${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const [session] = await this.db
      .insert(sessionTable)
      .values({
        id,
        name: input.name,
        serverId: input.serverId,
        botConfigId: input.botConfigId,
        state: 'CREATED',
        currentPhase: null,
        phasesJson: JSON.stringify(input.phases),
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return session;
  }

  async findById(id: string) {
    const [session] = await this.db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.id, id));
    return session ?? null;
  }

  async findAll() {
    return this.db.select().from(sessionTable);
  }

  async updateState(id: string, state: string, extra?: Record<string, unknown>) {
    await this.db
      .update(sessionTable)
      .set({ state, updatedAt: new Date().toISOString(), ...extra })
      .where(eq(sessionTable.id, id));
  }

  async recordPhase(sessionId: string, record: {
    phase: string;
    startedAt: string;
    finishedAt?: string;
    durationMs?: number;
    botCount: number;
    behavior: string;
    avgTps?: number;
    peakMemoryMb?: number;
    notes?: string;
  }) {
    await this.db.insert(phaseRecordTable).values({
      id: `pr_${randomUUID().slice(0, 8)}`,
      sessionId,
      ...record,
    });
  }
}
