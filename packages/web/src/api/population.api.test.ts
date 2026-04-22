import { describe, it, expect, vi, beforeEach } from 'vitest';
import { populationApi } from './population.api.js';

// Mock the apiFetch function
vi.mock('./client.js', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from './client.js';
const mockApiFetch = vi.mocked(apiFetch);

describe('populationApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getHistory', () => {
    it('should return unwrapped data from server envelope', async () => {
      const records = [
        { id: 1, serverId: 'srv-1', serverName: 'S1', timestamp: '2026-04-07T12:00:00Z', onlinePlayers: 5, maxPlayers: 20 },
      ];
      mockApiFetch.mockResolvedValue({ success: true, data: records });

      const result = await populationApi.getHistory();
      expect(result).toEqual(records);
    });

    it('should return empty array when data is undefined', async () => {
      mockApiFetch.mockResolvedValue({ success: true, data: undefined });

      const result = await populationApi.getHistory();
      expect(result).toEqual([]);
    });

    it('should call apiFetch without query params when none provided', async () => {
      mockApiFetch.mockResolvedValue({ success: true, data: [] });

      await populationApi.getHistory();
      expect(mockApiFetch).toHaveBeenCalledWith('/population');
    });

    it('should build query string with serverId', async () => {
      mockApiFetch.mockResolvedValue({ success: true, data: [] });

      await populationApi.getHistory({ serverId: 'srv-1' });
      expect(mockApiFetch).toHaveBeenCalledWith('/population?serverId=srv-1');
    });

    it('should build query string with all params', async () => {
      mockApiFetch.mockResolvedValue({ success: true, data: [] });

      await populationApi.getHistory({
        serverId: 'srv-1',
        startTime: '2026-04-07T00:00:00Z',
        endTime: '2026-04-07T23:59:59Z',
        limit: 100,
      });

      const url = mockApiFetch.mock.calls[0]![0] as string;
      expect(url).toContain('serverId=srv-1');
      expect(url).toContain('limit=100');
      expect(url).toContain('startTime=');
      expect(url).toContain('endTime=');
    });

    it('should not include undefined params in query string', async () => {
      mockApiFetch.mockResolvedValue({ success: true, data: [] });

      await populationApi.getHistory({ serverId: undefined, limit: undefined });
      expect(mockApiFetch).toHaveBeenCalledWith('/population');
    });
  });

  describe('cleanup', () => {
    it('should call DELETE with days param and return deleted count', async () => {
      mockApiFetch.mockResolvedValue({ success: true, deleted: 42 });

      const result = await populationApi.cleanup(7);
      expect(result).toBe(42);
      expect(mockApiFetch).toHaveBeenCalledWith('/population/retention?days=7', { method: 'DELETE' });
    });

    it('should return deleted count from envelope', async () => {
      mockApiFetch.mockResolvedValue({ success: true, deleted: 0 });

      const result = await populationApi.cleanup(30);
      expect(result).toBe(0);
    });
  });
});
