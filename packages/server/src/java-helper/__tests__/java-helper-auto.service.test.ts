import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JavaHelperAutoService } from '../java-helper-auto.service.js';

function createMockJavaHelper() {
  return {
    sendCommand: vi.fn().mockResolvedValue({ success: true }),
    start: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn(),
  } as any;
}

describe('JavaHelperAutoService', () => {
  let service: JavaHelperAutoService;
  let mockHelper: ReturnType<typeof createMockJavaHelper>;

  beforeEach(() => {
    mockHelper = createMockJavaHelper();
    service = new JavaHelperAutoService(mockHelper);
  });

  describe('config management', () => {
    it('should return default config when not set', () => {
      const config = service.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.attachPhases).toEqual([]);
    });

    it('should update and return config', () => {
      service.setConfig({ enabled: true, attachPhases: ['profiling', 'ramp-up'] });
      const config = service.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.attachPhases).toEqual(['profiling', 'ramp-up']);
    });

    it('should create a copy of attachPhases to prevent mutation', () => {
      const phases = ['profiling'];
      service.setConfig({ enabled: true, attachPhases: phases });
      phases.push('mutated');
      expect(service.getConfig().attachPhases).toEqual(['profiling']);
    });
  });

  describe('session lifecycle', () => {
    it('should not start auto-session when disabled', async () => {
      await service.onSessionStarted('sess-1', 'server-1');
      expect(mockHelper.sendCommand).not.toHaveBeenCalled();
      expect(service.isAutoSessionActive()).toBe(false);
    });

    it('should start auto-session when enabled', async () => {
      service.setConfig({ enabled: true, attachPhases: ['profiling'] });
      await service.onSessionStarted('sess-1', 'server-1');
      expect(mockHelper.sendCommand).toHaveBeenCalledWith('auto-session-start', expect.any(Object));
      expect(service.isAutoSessionActive()).toBe(true);
    });

    it('should start profiling when matching phase is entered', async () => {
      service.setConfig({ enabled: true, attachPhases: ['ramp-up'] });
      await service.onSessionStarted('sess-1', 'server-1');
      mockHelper.sendCommand.mockClear();

      await service.onPhaseEntered('sess-1', 'ramp-up');
      expect(mockHelper.sendCommand).toHaveBeenCalledWith('profile-start', { durationSeconds: 30 });
    });

    it('should not start profiling for non-matching phase', async () => {
      service.setConfig({ enabled: true, attachPhases: ['ramp-up'] });
      await service.onSessionStarted('sess-1', 'server-1');
      mockHelper.sendCommand.mockClear();

      await service.onPhaseEntered('sess-1', 'cool-down');
      expect(mockHelper.sendCommand).not.toHaveBeenCalled();
    });

    it('should clean up on session end', async () => {
      service.setConfig({ enabled: true, attachPhases: ['profiling'] });
      await service.onSessionStarted('sess-1', 'server-1');
      mockHelper.sendCommand.mockClear();

      await service.onSessionEnded('sess-1');
      expect(mockHelper.sendCommand).toHaveBeenCalledWith('auto-session-stop');
      expect(service.isAutoSessionActive()).toBe(false);
    });

    it('should handle sendCommand failures gracefully', async () => {
      service.setConfig({ enabled: true, attachPhases: ['profiling'] });
      mockHelper.sendCommand.mockRejectedValueOnce(new Error('Process not running'));

      // Should not throw
      await service.onSessionStarted('sess-1', 'server-1');
      expect(service.isAutoSessionActive()).toBe(true);
    });
  });
});
