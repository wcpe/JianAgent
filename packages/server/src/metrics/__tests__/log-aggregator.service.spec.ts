import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogAggregatorService } from '../log-aggregator.service.js';

function createMockLogStore() {
  return {
    insert: vi.fn().mockResolvedValue('mock-id'),
    query: vi.fn().mockResolvedValue({ entries: [], total: 0, page: 1, limit: 50 }),
  };
}

describe('LogAggregatorService', () => {
  let service: LogAggregatorService;
  let logStore: ReturnType<typeof createMockLogStore>;

  beforeEach(() => {
    logStore = createMockLogStore();
    service = new LogAggregatorService(logStore as any);
  });

  it('should ingest and store log entry', async () => {
    await service.ingest({
      level: 'INFO',
      source: 'SYSTEM',
      module: 'test',
      message: 'hello',
    });
    expect(logStore.insert).toHaveBeenCalledOnce();
    const arg = logStore.insert.mock.calls[0][0];
    expect(arg.level).toBe('INFO');
    expect(arg.source).toBe('SYSTEM');
    expect(arg.message).toBe('hello');
  });

  it('should emit log.entry event after ingestion', async () => {
    const handler = vi.fn();
    service.on('log.entry', handler);
    await service.ingest({
      level: 'ERROR',
      source: 'SYSTEM',
      module: 'test',
      message: 'failure',
    });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].id).toBe(0);
    expect(handler.mock.calls[0][0].level).toBe('ERROR');
  });

  it('should delegate query to log store', async () => {
    await service.query({ level: 'INFO' as any });
    expect(logStore.query).toHaveBeenCalledWith({ level: 'INFO' });
  });
});
