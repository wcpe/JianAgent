import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../storage/schema.js';
import { OperationJobService } from '../orchestrator/operation-job.service.js';
import { PolicyEngineService } from '../policy/policy-engine.service.js';

describe('PolicyEngineService', () => {
  let sqlite: Database.Database;
  let service: PolicyEngineService;

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
    `);
    const jobs = new OperationJobService(db);
    service = new PolicyEngineService(jobs);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('updates rule and triggers configured action', () => {
    service.updateRule({ cpuThreshold: 70, fullGcThreshold: 2, action: 'scale' });
    const result = service.evaluateAndTrigger({
      tenantId: 'tenant-a',
      target: 'inst-1',
      cpu: 80,
      fullGcCount: 2,
    });

    expect(result.triggered).toBe(true);
    expect((result as { action: string }).action).toBe('scale');
  });
});
