import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GovernanceService,
  ValidationVerdict,
} from '../governance.service.js';
import type { OperationJobService } from '../../orchestrator/operation-job.service.js';
import type { PolicyEngineService } from '../../policy/policy-engine.service.js';

describe('GovernanceService', () => {
  let service: GovernanceService;
  let mockJobService: { setStatus: ReturnType<typeof vi.fn> };
  let mockPolicyEngine: Record<string, unknown>;

  beforeEach(() => {
    mockJobService = {
      setStatus: vi.fn(),
    };
    mockPolicyEngine = {};
    service = new GovernanceService(
      mockJobService as unknown as OperationJobService,
      mockPolicyEngine as unknown as PolicyEngineService,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('evaluateVerdict - action resolution', () => {
    it('approves when passed with score >= 0.9', () => {
      const verdict: ValidationVerdict = {
        jobId: 'job-1',
        tenantId: 'tenant-a',
        passed: true,
        score: 0.95,
        anomalies: [],
        recommendations: [],
      };

      const decision = service.evaluateVerdict(verdict);

      expect(decision.action).toBe('approve');
      expect(decision.jobId).toBe('job-1');
      expect(mockJobService.setStatus).toHaveBeenCalledWith('job-1', 'SUCCEEDED');
    });

    it('approves when passed with score >= 0.7 and no anomalies', () => {
      const verdict: ValidationVerdict = {
        jobId: 'job-2',
        tenantId: 'tenant-a',
        passed: true,
        score: 0.8,
        anomalies: [],
        recommendations: ['Improve caching'],
      };

      const decision = service.evaluateVerdict(verdict);

      expect(decision.action).toBe('approve');
      expect(mockJobService.setStatus).toHaveBeenCalledWith('job-2', 'SUCCEEDED');
    });

    it('escalates when passed with score >= 0.7 but has anomalies', () => {
      const verdict: ValidationVerdict = {
        jobId: 'job-3',
        tenantId: 'tenant-a',
        passed: true,
        score: 0.75,
        anomalies: ['Minor latency spike'],
        recommendations: [],
      };

      const decision = service.evaluateVerdict(verdict);

      expect(decision.action).toBe('escalate');
      expect(mockJobService.setStatus).toHaveBeenCalledWith(
        'job-3',
        'PENDING_VERDICT',
      );
    });

    it('rolls back when not passed with score < 0.3', () => {
      const verdict: ValidationVerdict = {
        jobId: 'job-4',
        tenantId: 'tenant-a',
        passed: false,
        score: 0.1,
        anomalies: ['Critical failure'],
        recommendations: [],
      };

      const decision = service.evaluateVerdict(verdict);

      expect(decision.action).toBe('rollback');
      expect(mockJobService.setStatus).toHaveBeenCalledWith(
        'job-4',
        'ROLLING_BACK',
      );
    });

    it('rejects when not passed and anomalies > 2', () => {
      const verdict: ValidationVerdict = {
        jobId: 'job-5',
        tenantId: 'tenant-a',
        passed: false,
        score: 0.5,
        anomalies: ['Error 1', 'Error 2', 'Error 3'],
        recommendations: [],
      };

      const decision = service.evaluateVerdict(verdict);

      expect(decision.action).toBe('reject');
      expect(mockJobService.setStatus).toHaveBeenCalledWith('job-5', 'FAILED');
    });

    it('retries as default action for unclassified cases', () => {
      const verdict: ValidationVerdict = {
        jobId: 'job-6',
        tenantId: 'tenant-a',
        passed: false,
        score: 0.5,
        anomalies: ['Single anomaly'],
        recommendations: [],
      };

      const decision = service.evaluateVerdict(verdict);

      expect(decision.action).toBe('retry');
      expect(mockJobService.setStatus).toHaveBeenCalledWith('job-6', 'PENDING');
    });
  });

  describe('evaluateVerdict - decision recording', () => {
    it('records decision with timestamp', () => {
      const verdict: ValidationVerdict = {
        jobId: 'job-7',
        tenantId: 'tenant-a',
        passed: true,
        score: 0.95,
        anomalies: [],
        recommendations: [],
      };

      const decision = service.evaluateVerdict(verdict);

      expect(decision.timestamp).toBeInstanceOf(Date);
    });

    it('builds reason with anomalies', () => {
      const verdict: ValidationVerdict = {
        jobId: 'job-8',
        tenantId: 'tenant-a',
        passed: true,
        score: 0.75,
        anomalies: ['Spike in TPS'],
        recommendations: ['Scale up'],
      };

      const decision = service.evaluateVerdict(verdict);

      expect(decision.reason).toContain('Anomalies detected: Spike in TPS');
      expect(decision.reason).toContain('Recommendations: Scale up');
    });

    it('stores decision in history', () => {
      const verdict1: ValidationVerdict = {
        jobId: 'job-9',
        tenantId: 'tenant-a',
        passed: true,
        score: 0.95,
        anomalies: [],
        recommendations: [],
      };
      const verdict2: ValidationVerdict = {
        jobId: 'job-9',
        tenantId: 'tenant-a',
        passed: true,
        score: 0.9,
        anomalies: [],
        recommendations: [],
      };

      service.evaluateVerdict(verdict1);
      service.evaluateVerdict(verdict2);

      const decisions = service.getDecisionsForJob('job-9');
      expect(decisions).toHaveLength(2);
    });
  });

  describe('getDecisionsForJob', () => {
    it('returns empty array when no decisions exist', () => {
      const decisions = service.getDecisionsForJob('nonexistent');
      expect(decisions).toEqual([]);
    });

    it('filters decisions by jobId', () => {
      service.evaluateVerdict({
        jobId: 'job-a',
        tenantId: 'tenant-1',
        passed: true,
        score: 0.95,
        anomalies: [],
        recommendations: [],
      });
      service.evaluateVerdict({
        jobId: 'job-b',
        tenantId: 'tenant-1',
        passed: false,
        score: 0.2,
        anomalies: ['a', 'b', 'c'],
        recommendations: [],
      });

      const jobADecisions = service.getDecisionsForJob('job-a');
      expect(jobADecisions).toHaveLength(1);
      expect(jobADecisions[0].action).toBe('approve');
    });
  });

  describe('getDecisionsForTenant', () => {
    it('returns all decisions when no prefix provided', () => {
      service.evaluateVerdict({
        jobId: 'tenant-1:job-1',
        tenantId: 'tenant-1',
        passed: true,
        score: 0.95,
        anomalies: [],
        recommendations: [],
      });
      service.evaluateVerdict({
        jobId: 'tenant-2:job-1',
        tenantId: 'tenant-2',
        passed: true,
        score: 0.95,
        anomalies: [],
        recommendations: [],
      });

      const all = service.getDecisionsForTenant('tenant-1');
      expect(all).toHaveLength(2);
    });

    it('filters by jobId prefix when provided', () => {
      service.evaluateVerdict({
        jobId: 'tenant-1:job-1',
        tenantId: 'tenant-1',
        passed: true,
        score: 0.95,
        anomalies: [],
        recommendations: [],
      });
      service.evaluateVerdict({
        jobId: 'tenant-2:job-1',
        tenantId: 'tenant-2',
        passed: true,
        score: 0.95,
        anomalies: [],
        recommendations: [],
      });

      const filtered = service.getDecisionsForTenant('tenant-1', 'tenant-1:');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].jobId).toBe('tenant-1:job-1');
    });
  });

  describe('status progression regression', () => {
    it('approve -> SUCCEEDED status mapping is correct', () => {
      service.evaluateVerdict({
        jobId: 'reg-1',
        tenantId: 't',
        passed: true,
        score: 1.0,
        anomalies: [],
        recommendations: [],
      });
      expect(mockJobService.setStatus).toHaveBeenCalledWith('reg-1', 'SUCCEEDED');
    });

    it('reject -> FAILED status mapping is correct', () => {
      service.evaluateVerdict({
        jobId: 'reg-2',
        tenantId: 't',
        passed: false,
        score: 0.5,
        anomalies: ['a', 'b', 'c'],
        recommendations: [],
      });
      expect(mockJobService.setStatus).toHaveBeenCalledWith('reg-2', 'FAILED');
    });

    it('rollback -> ROLLING_BACK status mapping is correct', () => {
      service.evaluateVerdict({
        jobId: 'reg-3',
        tenantId: 't',
        passed: false,
        score: 0.1,
        anomalies: ['fatal'],
        recommendations: [],
      });
      expect(mockJobService.setStatus).toHaveBeenCalledWith(
        'reg-3',
        'ROLLING_BACK',
      );
    });

    it('escalate -> PENDING_VERDICT status mapping is correct', () => {
      service.evaluateVerdict({
        jobId: 'reg-4',
        tenantId: 't',
        passed: true,
        score: 0.8,
        anomalies: ['warn'],
        recommendations: [],
      });
      expect(mockJobService.setStatus).toHaveBeenCalledWith(
        'reg-4',
        'PENDING_VERDICT',
      );
    });

    it('retry -> PENDING status mapping is correct', () => {
      service.evaluateVerdict({
        jobId: 'reg-5',
        tenantId: 't',
        passed: false,
        score: 0.5,
        anomalies: [],
        recommendations: [],
      });
      expect(mockJobService.setStatus).toHaveBeenCalledWith('reg-5', 'PENDING');
    });
  });
});
