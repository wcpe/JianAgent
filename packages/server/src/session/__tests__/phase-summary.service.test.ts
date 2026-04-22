import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PhaseSummaryService, type PhaseContext } from '../phase-summary.service.js';

function createMockDb() {
  return {
    run: vi.fn().mockResolvedValue(undefined),
    all: vi.fn().mockResolvedValue([]),
  };
}

describe('PhaseSummaryService', () => {
  let service: PhaseSummaryService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new PhaseSummaryService(mockDb as any);
  });

  const baseContext: PhaseContext = {
    phaseName: 'ramp-up',
    startedAt: '2026-01-01T00:00:00.000Z',
    endedAt: '2026-01-01T00:01:00.000Z',
    botsAtEntry: 10,
    botsAtExit: 8,
    disconnectCount: 2,
    errorCount: 1,
    tpsSamples: [20, 19, 18, 17],
    msptSamples: [50, 55, 60, 65],
    completionStatus: 'completed',
  };

  it('should generate summary with correct metrics', async () => {
    const result = await service.generateSummary('sess-1', 0, baseContext);

    expect(result.sessionId).toBe('sess-1');
    expect(result.phaseIndex).toBe(0);
    expect(result.phaseName).toBe('ramp-up');
    expect(result.durationMs).toBe(60_000);
    expect(result.avgTps).toBeCloseTo(18.5);
    expect(result.minTps).toBe(17);
    expect(result.avgMspt).toBeCloseTo(57.5);
    expect(result.maxMspt).toBe(65);
    expect(result.completionStatus).toBe('completed');
    expect(mockDb.run).toHaveBeenCalledTimes(1);
  });

  it('should handle empty TPS/MSPT samples gracefully', async () => {
    const context: PhaseContext = {
      ...baseContext,
      tpsSamples: [],
      msptSamples: [],
    };
    const result = await service.generateSummary('sess-2', 1, context);
    expect(result.avgTps).toBeNull();
    expect(result.minTps).toBeNull();
    expect(result.avgMspt).toBeNull();
    expect(result.maxMspt).toBeNull();
  });

  it('should record and retrieve baseline snapshots', () => {
    service.recordBaseline('sess-3', 0, { botCount: 10, tps: 20, mspt: 50 });
    const baseline = service.getBaseline('sess-3', 0);
    expect(baseline).toEqual({ botCount: 10, tps: 20, mspt: 50 });
  });

  it('should clear baseline after generating summary', async () => {
    service.recordBaseline('sess-4', 0, { botCount: 5, tps: 19, mspt: 45 });
    await service.generateSummary('sess-4', 0, baseContext);
    expect(service.getBaseline('sess-4', 0)).toBeUndefined();
  });

  it('should return empty array for unknown session summaries', async () => {
    const results = await service.getSummariesBySession('unknown');
    expect(results).toEqual([]);
  });
});
