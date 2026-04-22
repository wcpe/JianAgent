import { describe, expect, it, vi } from 'vitest';
import { ValidationEvidenceService } from '../validation-evidence.service.js';

describe('ValidationEvidenceService', () => {
  it('persists startup report evidence and emits a local-validation.evidence event', async () => {
    const store = {
      appendEvidence: vi.fn().mockResolvedValue({
        id: 'lve_1',
        runId: 'lvr_1',
        kind: 'operation',
        timestamp: '2026-04-19T10:00:00.000Z',
        summary: '启动报告',
        payload: { report: { sections: [] } },
      }),
    };
    const eventBus = {
      emit: vi.fn(),
    };

    const service = new ValidationEvidenceService(store as never, eventBus as never);
    const evidence = await service.appendStartupReport('lvr_1', {
      runId: 'lvr_1',
      status: 'READY',
      sections: [],
    });

    expect(store.appendEvidence).toHaveBeenCalledWith({
      runId: 'lvr_1',
      evidenceKind: 'operation',
      summary: '启动报告',
      payload: {
        report: {
          runId: 'lvr_1',
          status: 'READY',
          sections: [],
        },
      },
    });
    expect(eventBus.emit).toHaveBeenCalledWith(
      'local-validation.evidence',
      expect.objectContaining({
        runId: 'lvr_1',
        evidenceId: 'lve_1',
        kind: 'operation',
        summary: '启动报告',
      }),
    );
    expect(evidence.id).toBe('lve_1');
  });
});
