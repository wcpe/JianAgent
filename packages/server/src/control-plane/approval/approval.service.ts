import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import type { DrizzleDb } from '../../storage/drizzle.provider.js';
import { DRIZZLE_TOKEN } from '../../storage/drizzle.provider.js';
import { cpApprovalTickets } from '../../storage/schema.js';

@Injectable()
export class ApprovalService {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  requiresApproval(danger: boolean): boolean {
    return danger;
  }

  createTicket(jobId: string, tenantId: string) {
    const confirmationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const row = {
      id: randomUUID(),
      jobId,
      tenantId,
      state: 'pending',
      confirmationCode,
      expiresAt,
      createdAt: new Date(),
    };
    this.db.insert(cpApprovalTickets).values(row).run();
    return row;
  }

  approve(ticketId: string, confirmationCode: string) {
    const now = new Date();
    const current = this.db
      .select()
      .from(cpApprovalTickets)
      .where(eq(cpApprovalTickets.id, ticketId))
      .all()[0];

    if (!current) {
      throw new Error(`Approval ticket not found: ${ticketId}`);
    }
    if (current.state !== 'pending') {
      throw new Error(`Approval ticket is not pending: ${ticketId}`);
    }
    if (current.expiresAt < now) {
      this.db
        .update(cpApprovalTickets)
        .set({ state: 'expired' })
        .where(eq(cpApprovalTickets.id, ticketId))
        .run();
      throw new Error(`Approval ticket expired: ${ticketId}`);
    }
    if (current.confirmationCode !== confirmationCode) {
      throw new Error('Invalid approval confirmation code');
    }

    this.db
      .update(cpApprovalTickets)
      .set({ state: 'approved' })
      .where(eq(cpApprovalTickets.id, ticketId))
      .run();
    return this.db
      .select()
      .from(cpApprovalTickets)
      .where(eq(cpApprovalTickets.id, ticketId))
      .all()[0];
  }

  listPending(tenantId: string) {
    return this.db
      .select()
      .from(cpApprovalTickets)
      .where(eq(cpApprovalTickets.tenantId, tenantId))
      .all()
      .filter((item) => item.state === 'pending');
  }

  sweepExpired(): number {
    const now = new Date();
    const result = this.db
      .update(cpApprovalTickets)
      .set({ state: 'expired' })
      .where(lt(cpApprovalTickets.expiresAt, now))
      .run();
    return result.changes;
  }
}
