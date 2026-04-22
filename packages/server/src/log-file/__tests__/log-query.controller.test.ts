import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { LogQueryController } from '../log-query.controller.js';

describe('LogQueryController', () => {
  it('rejects empty query', async () => {
    const service = { aggregateSearch: vi.fn() } as any;
    const controller = new LogQueryController(service);

    await expect(controller.aggregate('   ')).rejects.toBeInstanceOf(BadRequestException);
    expect(service.aggregateSearch).not.toHaveBeenCalled();
  });

  it('rejects invalid time window', async () => {
    const service = { aggregateSearch: vi.fn() } as any;
    const controller = new LogQueryController(service);

    await expect(
      controller.aggregate(
        'ERROR',
        undefined,
        undefined,
        undefined,
        '2026-04-14T10:00:00.000Z',
        '2026-04-14T09:00:00.000Z',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes params and forwards to service', async () => {
    const service = {
      aggregateSearch: vi.fn().mockResolvedValue({
        entries: [{ serverId: 's1', file: 'latest.log', line: 1, content: 'ERROR' }],
        backend: 'local-file',
        degraded: false,
      }),
    } as any;
    const controller = new LogQueryController(service);

    const res = await controller.aggregate(
      '  ERROR  ',
      's1, s1, s2',
      '50',
      '300',
      '2026-04-14T08:00:00.000Z',
      '2026-04-14T09:00:00.000Z',
      'true',
      'content,file,bad',
    );

    expect(service.aggregateSearch).toHaveBeenCalledWith({
      query: 'ERROR',
      serverIds: ['s1', 's2'],
      maxPerServer: 50,
      maxTotal: 300,
      startTime: '2026-04-14T08:00:00.000Z',
      endTime: '2026-04-14T09:00:00.000Z',
      caseSensitive: true,
      fields: ['content', 'file'],
    });
    expect(res.entries).toHaveLength(1);
    expect(res.backend).toBe('local-file');
    expect(res.degraded).toBe(false);
  });

  it('normalizes recent-log params and forwards to service', async () => {
    const service = {
      recentLogs: vi.fn().mockResolvedValue({
        entries: [{ serverId: 's1', file: 'latest.log', line: 1, content: 'ready' }],
        backend: 'local-file',
        degraded: false,
      }),
    } as any;
    const controller = new LogQueryController(service);

    const res = await controller.recent('s1, s1, s2', '80', '120');

    expect(service.recentLogs).toHaveBeenCalledWith({
      serverIds: ['s1', 's2'],
      linesPerServer: 80,
      maxTotal: 120,
    });
    expect(res.entries).toHaveLength(1);
  });
});
