import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogExportController } from '../log-export.controller.js';

function createController() {
  const mockEntries = [
    { timestamp: '2026-04-23T10:00:00Z', level: 'ERROR', hostName: 'srv1', sourceFile: 'latest.log', content: 'NullPointerException' },
    { timestamp: '2026-04-23T10:00:01Z', level: 'INFO', hostName: 'srv1', sourceFile: 'latest.log', content: 'Player joined' },
    { timestamp: '2026-04-23T10:00:02Z', level: 'WARN', hostName: 'srv2', sourceFile: 'latest.log', content: 'Can\'t keep up!' },
  ];

  const searchService = {
    ftsSearch: vi.fn().mockReturnValue({ entries: mockEntries, total: 3 }),
  };

  const controller = new LogExportController(searchService as any);
  return { controller, searchService, mockEntries };
}

describe('LogExportController', () => {
  let controller: LogExportController;
  let searchService: { ftsSearch: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    ({ controller, searchService } = createController());
  });

  describe('exportLogs - JSON format', () => {
    it('should return entries in JSON format', async () => {
      const result = await controller.exportLogs('error', undefined, 'ERROR', undefined, undefined, 'json');
      expect(result.success).toBe(true);
      expect(result.data.format).toBe('json');
      expect(result.data.entries).toHaveLength(3);
    });

    it('should pass query params to ftsSearch', async () => {
      await controller.exportLogs('test', 'srv1,srv2', 'ERROR', '2026-04-23T00:00:00Z', '2026-04-23T23:59:59Z', 'json', '100');
      expect(searchService.ftsSearch).toHaveBeenCalledWith({
        q: 'test',
        hosts: ['srv1', 'srv2'],
        level: 'ERROR',
        startTime: '2026-04-23T00:00:00Z',
        endTime: '2026-04-23T23:59:59Z',
        page: 1,
        limit: 100,
      });
    });
  });

  describe('exportLogs - CSV format', () => {
    it('should return CSV content', async () => {
      const result = await controller.exportLogs(undefined, undefined, undefined, undefined, undefined, 'csv');
      expect(result.success).toBe(true);
      expect(result.data.format).toBe('csv');
      expect(result.data.content).toContain('timestamp,level,host,source,content');
      expect(result.data.total).toBe(3);
    });

    it('should escape double quotes in CSV content', async () => {
      searchService.ftsSearch.mockReturnValue({
        entries: [{ timestamp: 't', level: 'INFO', hostName: 'h', sourceFile: 'f', content: 'say "hello"' }],
        total: 1,
      });
      const result = await controller.exportLogs(undefined, undefined, undefined, undefined, undefined, 'csv');
      expect(result.data.content).toContain('""hello""');
    });

    it('should default to csv format when not specified', async () => {
      const result = await controller.exportLogs();
      expect(result.data.format).toBe('csv');
    });
  });

  describe('limit handling', () => {
    it('should default to 5000', async () => {
      await controller.exportLogs();
      expect(searchService.ftsSearch).toHaveBeenCalledWith(expect.objectContaining({ limit: 5000 }));
    });

    it('should cap at 10000', async () => {
      await controller.exportLogs(undefined, undefined, undefined, undefined, undefined, 'csv', '99999');
      expect(searchService.ftsSearch).toHaveBeenCalledWith(expect.objectContaining({ limit: 10000 }));
    });

    it('should treat 0 as default 5000 (falsy parseInt result)', async () => {
      await controller.exportLogs(undefined, undefined, undefined, undefined, undefined, 'csv', '0');
      expect(searchService.ftsSearch).toHaveBeenCalledWith(expect.objectContaining({ limit: 5000 }));
    });

    it('should handle non-numeric limit gracefully', async () => {
      await controller.exportLogs(undefined, undefined, undefined, undefined, undefined, 'csv', 'abc');
      expect(searchService.ftsSearch).toHaveBeenCalledWith(expect.objectContaining({ limit: 5000 }));
    });
  });

  describe('host parsing', () => {
    it('should split comma-separated hosts', async () => {
      await controller.exportLogs(undefined, 'a,b,c');
      expect(searchService.ftsSearch).toHaveBeenCalledWith(expect.objectContaining({ hosts: ['a', 'b', 'c'] }));
    });

    it('should filter empty strings from hosts', async () => {
      await controller.exportLogs(undefined, 'a,,b,');
      expect(searchService.ftsSearch).toHaveBeenCalledWith(expect.objectContaining({ hosts: ['a', 'b'] }));
    });

    it('should pass undefined hosts when not provided', async () => {
      await controller.exportLogs();
      expect(searchService.ftsSearch).toHaveBeenCalledWith(expect.objectContaining({ hosts: undefined }));
    });
  });
});
