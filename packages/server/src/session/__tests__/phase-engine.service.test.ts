import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PhaseEngineService } from '../phase-engine.service';

describe('PhaseEngineService', () => {
  let engine: PhaseEngineService;
  let mockOrchestrator: any;
  let mockSessionService: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockOrchestrator = {
      createBotBatch: vi.fn(),
      setBehavior: vi.fn(() => true),
      stopBots: vi.fn(),
      stopAll: vi.fn(),
    };
    mockSessionService = {
      updateState: vi.fn(),
      recordPhase: vi.fn(),
      create: vi.fn(),
    };
    const mockValidationPlanService = {
      create: vi.fn(async () => ({ id: 'plan-1', name: 'Test Plan' })),
      findById: vi.fn(),
    };
    const mockValidationRunService = {
      create: vi.fn(async () => ({ id: 'run-1', planId: 'plan-1', status: 'pending' })),
      start: vi.fn(async (id: string) => ({ id, planId: 'plan-1', status: 'running' })),
      complete: vi.fn(async () => {}),
      fail: vi.fn(async () => {}),
    };
    engine = new PhaseEngineService(mockOrchestrator, mockSessionService, mockValidationRunService, mockValidationPlanService);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('should start a session and execute first phase', async () => {
    const phases = [
      { phase: 'ramp-up', botCount: 10, behavior: 'idle', durationSec: 5 },
    ];
    await engine.start('sess_1', 'srv_1', 'prefix', phases);
    expect(mockOrchestrator.createBotBatch).toHaveBeenCalled();
    expect(mockSessionService.updateState).toHaveBeenCalledWith('sess_1', 'RUNNING', expect.any(Object));
  });

  it('should transition to next phase after duration', async () => {
    const phases = [
      { phase: 'ramp-up', botCount: 5, behavior: 'idle', durationSec: 2 },
      { phase: 'peak', botCount: 10, behavior: 'move-random', durationSec: 3 },
    ];
    await engine.start('sess_1', 'srv_1', 'prefix', phases);
    await vi.advanceTimersByTimeAsync(2100);
    expect(mockSessionService.recordPhase).toHaveBeenCalled();
  });

  it('should stop session', async () => {
    const phases = [{ phase: 'test', botCount: 5, behavior: 'idle', durationSec: 60 }];
    await engine.start('sess_1', 'srv_1', 'prefix', phases);
    await engine.stop('sess_1');
    expect(mockOrchestrator.stopAll).toHaveBeenCalled();
    expect(mockSessionService.updateState).toHaveBeenCalledWith('sess_1', 'FINISHED', expect.any(Object));
  });
});
