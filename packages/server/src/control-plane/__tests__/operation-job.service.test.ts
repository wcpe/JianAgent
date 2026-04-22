import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../storage/schema.js';
import { OperationJobService } from '../orchestrator/operation-job.service.js';
import { PolicyEngineService } from '../policy/policy-engine.service.js';
import { ApprovalService } from '../approval/approval.service.js';

describe('OperationJobService', () => {
  let sqlite: Database.Database;
  let jobs: OperationJobService;
  let approval: ApprovalService;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema });
    sqlite.exec(`
      CREATE TABLE cp_operation_jobs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        target TEXT NOT NULL,
        version TEXT NOT NULL,
        batch TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        status TEXT NOT NULL,
        danger INTEGER NOT NULL,
        validation_plan_id TEXT,
        validation_run_id TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE cp_approval_tickets (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        state TEXT NOT NULL,
        confirmation_code TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    jobs = new OperationJobService(db);
    approval = new ApprovalService(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('returns existing job when idempotency key duplicated', () => {
    const first = jobs.create({
      tenantId: 'tenant-a',
      operation: 'start',
      target: 'inst-1',
      version: 'v1',
      batch: 'b1',
      danger: true,
    });
    const second = jobs.create({
      tenantId: 'tenant-a',
      operation: 'start',
      target: 'inst-1',
      version: 'v1',
      batch: 'b1',
      danger: true,
    });

    expect(second.id).toBe(first.id);
  });

  it('creates mitigation job when cpu and full gc exceed threshold', () => {
    const policy = new PolicyEngineService(jobs);
    const result = policy.evaluateAndTrigger({
      tenantId: 'tenant-a',
      target: 'inst-1',
      cpu: 95,
      fullGcCount: 3,
    });

    expect(result.triggered).toBe(true);
  });

  it('requires approval for dangerous jobs', () => {
    expect(approval.requiresApproval(true)).toBe(true);
    expect(approval.requiresApproval(false)).toBe(false);

    const job = jobs.create({
      tenantId: 'tenant-a',
      operation: 'restart',
      target: 'inst-1',
      version: 'v1',
      batch: 'b2',
      danger: true,
    });

    const ticket = approval.createTicket(job.id, job.tenantId);
    const pending = approval.listPending(job.tenantId);
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(ticket.id);
    expect(pending[0].confirmationCode).toBeDefined();

    const approved = approval.approve(ticket.id, ticket.confirmationCode);
    expect(approved?.state).toBe('approved');
  });
});
