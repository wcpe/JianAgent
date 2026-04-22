import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DebugRecorderService } from '../debug-recorder.service.js';

function createMockDb() {
  const mockClient = {
    prepare: vi.fn().mockReturnValue({
      run: vi.fn(),
      all: vi.fn().mockReturnValue([]),
    }),
  };

  return {
    session: { client: mockClient },
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    _client: mockClient,
  } as any;
}

describe('DebugRecorderService', () => {
  let service: DebugRecorderService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new DebugRecorderService(mockDb);
  });

  describe('startRecording', () => {
    it('should return a recording ID', async () => {
      const id = await service.startRecording('session-1', 'server-1');
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('should mark server as recording', async () => {
      await service.startRecording('session-1', 'server-1');
      expect(service.isRecording('server-1')).toBe(true);
    });

    it('should not mark unrelated server as recording', async () => {
      await service.startRecording('session-1', 'server-1');
      expect(service.isRecording('server-2')).toBe(false);
    });
  });

  describe('recordEvent', () => {
    it('should silently ignore events for non-recording servers', () => {
      // Should not throw
      service.recordEvent('unknown-server', 'output', 'test data');
    });

    it('should buffer events for recording server', async () => {
      await service.startRecording('session-1', 'server-1');
      service.recordEvent('server-1', 'output', 'hello world');
      // Event is buffered internally
      expect(service.isRecording('server-1')).toBe(true);
    });
  });

  describe('stopRecording', () => {
    it('should return null for non-recording servers', async () => {
      const result = await service.stopRecording('unknown');
      expect(result).toBeNull();
    });

    it('should return recording ID and clean up', async () => {
      const id = await service.startRecording('session-1', 'server-1');
      const resultId = await service.stopRecording('server-1');
      expect(resultId).toBe(id);
      expect(service.isRecording('server-1')).toBe(false);
    });

    it('should flush buffered events on stop', async () => {
      await service.startRecording('session-1', 'server-1');
      service.recordEvent('server-1', 'output', 'data-1');
      service.recordEvent('server-1', 'input', 'cmd');

      await service.stopRecording('server-1');
      // Verify the raw client was called to insert events
      expect(mockDb._client.prepare).toHaveBeenCalled();
    });
  });

  describe('getActiveRecordingId', () => {
    it('should return null when not recording', () => {
      expect(service.getActiveRecordingId('server-1')).toBeNull();
    });

    it('should return ID when recording', async () => {
      const id = await service.startRecording('session-1', 'server-1');
      expect(service.getActiveRecordingId('server-1')).toBe(id);
    });
  });
});
