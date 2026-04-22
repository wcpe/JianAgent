import { describe, expect, it, vi } from 'vitest';
import { LogFileService } from '../log-file.service.js';

describe('LogFileService aggregateSearch', () => {
  it('searches requested servers and includes serverId in result', async () => {
    const configService = {
      getAll: vi.fn().mockResolvedValue([{ id: 's1' }, { id: 's2' }]),
    } as any;

    const service = new LogFileService(configService);
    vi.spyOn(service, 'listLogFiles').mockResolvedValue([{ name: 'latest.log', size: 10, modifiedAt: new Date().toISOString(), isGzipped: false }]);
    vi.spyOn(service, 'searchLogFiles')
      .mockResolvedValueOnce([{ file: 'latest.log', line: 1, content: 'ERROR a' }])
      .mockResolvedValueOnce([{ file: 'latest.log', line: 2, content: 'ERROR b' }]);

    const results = await service.aggregateSearch({ query: 'ERROR', serverIds: ['s1', 's2'] });
    expect(results).toHaveLength(2);
    expect(results[0].serverId).toBe('s1');
    expect(results[1].serverId).toBe('s2');
  });

  it('falls back to all servers when serverIds not provided', async () => {
    const configService = {
      getAll: vi.fn().mockResolvedValue([{ id: 's1' }]),
    } as any;
    const service = new LogFileService(configService);

    vi.spyOn(service, 'listLogFiles').mockResolvedValue([{ name: 'latest.log', size: 10, modifiedAt: new Date().toISOString(), isGzipped: false }]);
    vi.spyOn(service, 'searchLogFiles').mockResolvedValue([{ file: 'latest.log', line: 7, content: 'WARN' }]);

    const results = await service.aggregateSearch({ query: 'WARN' });
    expect(configService.getAll).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0].serverId).toBe('s1');
  });

  it('filters files by modified time and forwards search options', async () => {
    const configService = {
      getAll: vi.fn().mockResolvedValue([{ id: 's1' }]),
    } as any;
    const service = new LogFileService(configService);

    vi.spyOn(service, 'listLogFiles').mockResolvedValue([
      { name: 'old.log', size: 10, modifiedAt: '2026-04-10T00:00:00.000Z', isGzipped: false },
      { name: 'new.log', size: 10, modifiedAt: '2026-04-14T00:00:00.000Z', isGzipped: false },
    ]);

    const searchSpy = vi
      .spyOn(service, 'searchLogFiles')
      .mockResolvedValue([{ file: 'new.log', line: 1, content: 'Error' }]);

    const results = await service.aggregateSearch({
      query: 'Error',
      startTime: '2026-04-13T00:00:00.000Z',
      caseSensitive: true,
      fields: ['file'],
    });

    expect(results).toHaveLength(1);
    expect(searchSpy).toHaveBeenCalledWith(
      's1',
      'Error',
      ['new.log'],
      200,
      { caseSensitive: true, fields: ['file'] },
    );
  });

  it('enforces maxTotal when aggregating across many servers', async () => {
    const configService = {
      getAll: vi.fn().mockResolvedValue([{ id: 's1' }, { id: 's2' }, { id: 's3' }]),
    } as any;
    const service = new LogFileService(configService);

    vi.spyOn(service, 'listLogFiles').mockResolvedValue([
      { name: 'latest.log', size: 10, modifiedAt: new Date().toISOString(), isGzipped: false },
    ]);
    vi.spyOn(service, 'searchLogFiles').mockResolvedValue([
      { file: 'latest.log', line: 1, content: 'ERROR-1' },
      { file: 'latest.log', line: 2, content: 'ERROR-2' },
    ]);

    const results = await service.aggregateSearch({ query: 'ERROR', maxTotal: 3 });

    expect(results).toHaveLength(3);
    expect(results[0]?.serverId).toBe('s1');
    expect(results[1]?.serverId).toBe('s1');
    expect(results[2]?.serverId).toBe('s2');
  });

  it('returns recent log lines from latest file per server', async () => {
    const configService = {
      getAll: vi.fn().mockResolvedValue([{ id: 's1' }]),
    } as any;
    const service = new LogFileService(configService);

    vi.spyOn(service, 'listLogFiles').mockResolvedValue([
      { name: 'latest.log', size: 10, modifiedAt: new Date().toISOString(), isGzipped: false },
    ]);
    vi.spyOn(service, 'tailLogFile').mockResolvedValue('line-1\nline-2\nline-3\n');

    const results = await service.getRecentEntries({ serverIds: ['s1'], linesPerServer: 2 });

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      serverId: 's1',
      file: 'latest.log',
      line: 1,
      content: 'line-3',
    });
    expect(results[1]?.content).toBe('line-2');
  });
});
