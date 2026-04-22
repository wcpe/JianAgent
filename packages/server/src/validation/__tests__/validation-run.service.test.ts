import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../storage/schema.js';
import { ValidationRunService } from '../validation-run.service.js';
import { ValidationRunMapper } from '../validation-run.mapper.js';

describe('ValidationRunService', () => {
  let sqlite: Database.Database;
  let service: ValidationRunService;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema });
    sqlite.exec(`
      CREATE TABLE validation_run (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        session_id TEXT,
        operation_job_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        started_at TEXT,
        completed_at TEXT,
        metrics_json TEXT,
        created_at TEXT NOT NULL
      );
    `);
    const mapper = new ValidationRunMapper();
    service = new ValidationRunService(db, mapper);
  });

  afterEach(() => {
    sqlite.close();
  });

  describe('create', () => {
    it('creates a new validation run with pending status', async () => {
      const run = await service.create('plan-1', 'server-1');

      expect(run.id).toMatch(/^vr_/);
      expect(run.planId).toBe('plan-1');
      expect(run.serverId).toBe('unknown');
      expect(run.status).toBe('pending');
      expect(run.startedAt).toBeNull();
      expect(run.finishedAt).toBeNull();
    });

    it('generates unique ids for each run', async () => {
      const run1 = await service.create('plan-1', 'server-1');
      const run2 = await service.create('plan-1', 'server-1');

      expect(run1.id).not.toBe(run2.id);
    });
  });

  describe('start', () => {
    it('transitions from pending to running', async () => {
      const run = await service.create('plan-1', 'server-1');
      const started = await service.start(run.id);

      expect(started.status).toBe('running');
      expect(started.startedAt).toBeDefined();
    });

    it('throws NotFoundException when run does not exist', async () => {
      await expect(service.start('nonexistent')).rejects.toThrow(
        'Validation run nonexistent not found',
      );
    });

    it('throws BadRequestException when run is not pending', async () => {
      const run = await service.create('plan-1', 'server-1');
      await service.start(run.id);

      await expect(service.start(run.id)).rejects.toThrow(
        'is not in pending state',
      );
    });
  });

  describe('complete', () => {
    it('transitions from running to completed with metrics', async () => {
      const run = await service.create('plan-1', 'server-1');
      await service.start(run.id);
      const completed = await service.complete(run.id, 'All checks passed', {
        passedChecks: 10,
        failedChecks: 0,
      });

      expect(completed.status).toBe('completed');
      expect(completed.finishedAt).toBeDefined();
      expect(completed.metrics).toEqual({ passedChecks: 10, failedChecks: 0 });
    });

    it('transitions to completed without metrics', async () => {
      const run = await service.create('plan-1', 'server-1');
      await service.start(run.id);
      const completed = await service.complete(run.id, 'Done');

      expect(completed.status).toBe('completed');
      expect(completed.metrics).toBeUndefined();
    });

    it('throws NotFoundException when run does not exist', async () => {
      await expect(
        service.complete('nonexistent', 'summary'),
      ).rejects.toThrow('Validation run nonexistent not found');
    });
  });

  describe('fail', () => {
    it('transitions to failed with error detail', async () => {
      const run = await service.create('plan-1', 'server-1');
      await service.start(run.id);
      const failed = await service.fail(run.id, 'Connection timeout');

      expect(failed.status).toBe('failed');
      expect(failed.finishedAt).toBeDefined();
      expect(failed.errorDetail).toBe('Connection timeout');
    });

    it('throws NotFoundException when run does not exist', async () => {
      await expect(service.fail('nonexistent', 'error')).rejects.toThrow(
        'Validation run nonexistent not found',
      );
    });
  });

  describe('cancel', () => {
    it('cancels a pending run', async () => {
      const run = await service.create('plan-1', 'server-1');
      const cancelled = await service.cancel(run.id);

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.finishedAt).toBeDefined();
    });

    it('cancels a running run', async () => {
      const run = await service.create('plan-1', 'server-1');
      await service.start(run.id);
      const cancelled = await service.cancel(run.id);

      expect(cancelled.status).toBe('cancelled');
    });

    it('throws BadRequestException when run is completed', async () => {
      const run = await service.create('plan-1', 'server-1');
      await service.start(run.id);
      await service.complete(run.id, 'Done');

      await expect(service.cancel(run.id)).rejects.toThrow(
        'Cannot cancel validation run in completed state',
      );
    });

    it('throws NotFoundException when run does not exist', async () => {
      await expect(service.cancel('nonexistent')).rejects.toThrow(
        'Validation run nonexistent not found',
      );
    });
  });

  describe('queries', () => {
    it('findById returns null for nonexistent run', async () => {
      const run = await service.findById('nonexistent');
      expect(run).toBeNull();
    });

    it('findById returns existing run', async () => {
      const created = await service.create('plan-1', 'server-1');
      const found = await service.findById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('findAll returns all runs', async () => {
      await service.create('plan-1', 'server-1');
      await service.create('plan-2', 'server-1');

      const all = await service.findAll();
      expect(all).toHaveLength(2);
    });

    it('findByPlanId filters by plan', async () => {
      await service.create('plan-1', 'server-1');
      await service.create('plan-1', 'server-2');
      await service.create('plan-2', 'server-1');

      const plan1Runs = await service.findByPlanId('plan-1');
      expect(plan1Runs).toHaveLength(2);
    });

    it('findRunning returns only running runs', async () => {
      const run1 = await service.create('plan-1', 'server-1');
      await service.create('plan-2', 'server-1');
      await service.start(run1.id);

      const running = await service.findRunning();
      expect(running).toHaveLength(1);
      expect(running[0].id).toBe(run1.id);
    });
  });

  describe('full lifecycle', () => {
    it('validates complete pending -> running -> completed flow', async () => {
      const run = await service.create('plan-1', 'server-1');
      expect(run.status).toBe('pending');

      const started = await service.start(run.id);
      expect(started.status).toBe('running');

      const completed = await service.complete(started.id, 'All OK', {
        duration: 1234,
      });
      expect(completed.status).toBe('completed');
      expect(completed.metrics).toEqual({ duration: 1234 });
    });

    it('validates complete pending -> running -> failed flow', async () => {
      const run = await service.create('plan-1', 'server-1');
      const started = await service.start(run.id);
      const failed = await service.fail(started.id, 'OOM error');

      expect(failed.status).toBe('failed');
      expect(failed.errorDetail).toBe('OOM error');
    });

    it('validates complete pending -> cancelled flow', async () => {
      const run = await service.create('plan-1', 'server-1');
      const cancelled = await service.cancel(run.id);

      expect(cancelled.status).toBe('cancelled');
    });

    it('validates complete running -> cancelled flow', async () => {
      const run = await service.create('plan-1', 'server-1');
      await service.start(run.id);
      const cancelled = await service.cancel(run.id);

      expect(cancelled.status).toBe('cancelled');
    });
  });
});
