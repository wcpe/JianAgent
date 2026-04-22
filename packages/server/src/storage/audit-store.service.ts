import { Injectable, Inject } from '@nestjs/common';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { DrizzleDb } from './drizzle.provider.js';
import { DRIZZLE_TOKEN } from './drizzle.provider.js';
import { auditRecords } from './schema.js';
import type { AuditRecord, AuditQueryParams, PaginatedResponse } from '@jian-agent/shared-domain';
import { LIMITS } from '@jian-agent/shared-domain';

@Injectable()
export class AuditStoreService {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  async create(input: Omit<AuditRecord, 'id'>): Promise<AuditRecord> {
    const id = randomUUID();
    const row = { id, ...input };
    this.db.insert(auditRecords).values(row).run();
    return row;
  }

  async query(params: AuditQueryParams): Promise<PaginatedResponse<AuditRecord>> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? LIMITS.AUDIT_PAGE_SIZE_DEFAULT, LIMITS.AUDIT_PAGE_SIZE_MAX);
    const offset = (page - 1) * limit;

    const conditions = [];
    if (params.userId) conditions.push(eq(auditRecords.userId, params.userId));
    if (params.operation) conditions.push(eq(auditRecords.operation, params.operation));
    if (params.startTime) conditions.push(gte(auditRecords.timestamp, params.startTime));
    if (params.endTime) conditions.push(lte(auditRecords.timestamp, params.endTime));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const items = this.db
      .select()
      .from(auditRecords)
      .where(where)
      .orderBy(desc(auditRecords.timestamp))
      .limit(limit)
      .offset(offset)
      .all();

    const countResult = this.db
      .select()
      .from(auditRecords)
      .where(where)
      .all();

    return { items, total: countResult.length, page, limit };
  }
}
