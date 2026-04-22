import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PopulationController } from '../population.controller.js';

function createMockService() {
  return {
    getHistory: vi.fn().mockReturnValue([]),
    cleanup: vi.fn().mockReturnValue(0),
  };
}

describe('PopulationController', () => {
  let controller: PopulationController;
  let mockService: ReturnType<typeof createMockService>;

  beforeEach(() => {
    mockService = createMockService();
    controller = new PopulationController(mockService as any);
  });

  it('getHistory should return success envelope with data', () => {
    const records = [{ id: 1, serverId: 'srv-1', serverName: 'S1', timestamp: '2026-04-07T12:00:00Z', onlinePlayers: 5, maxPlayers: 20 }];
    mockService.getHistory.mockReturnValue(records);

    const result = controller.getHistory();
    expect(result).toEqual({ success: true, data: records });
  });

  it('getHistory should pass query params to service', () => {
    controller.getHistory('srv-1', '2026-04-07T00:00:00Z', '2026-04-07T23:59:59Z', '100');

    expect(mockService.getHistory).toHaveBeenCalledWith({
      serverId: 'srv-1',
      startTime: '2026-04-07T00:00:00Z',
      endTime: '2026-04-07T23:59:59Z',
      limit: 100,
    });
  });

  it('getHistory should parse limit as integer', () => {
    controller.getHistory(undefined, undefined, undefined, '500');

    expect(mockService.getHistory).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 500 }),
    );
  });

  it('getHistory should default limit to 1440', () => {
    controller.getHistory();

    expect(mockService.getHistory).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1440 }),
    );
  });

  it('getHistory should convert empty string params to undefined', () => {
    controller.getHistory('', '', '', '');

    expect(mockService.getHistory).toHaveBeenCalledWith({
      serverId: undefined,
      startTime: undefined,
      endTime: undefined,
      limit: 1440,
    });
  });

  it('cleanup should return success envelope with deleted count', () => {
    mockService.cleanup.mockReturnValue(42);

    const result = controller.cleanup('7');
    expect(result).toEqual({ success: true, deleted: 42 });
    expect(mockService.cleanup).toHaveBeenCalledWith(7);
  });

  it('cleanup should default days to 30', () => {
    controller.cleanup();

    expect(mockService.cleanup).toHaveBeenCalledWith(30);
  });

  it('cleanup should parse days as integer', () => {
    controller.cleanup('14');

    expect(mockService.cleanup).toHaveBeenCalledWith(14);
  });
});
