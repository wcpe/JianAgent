import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeLogBridgeService } from '../node-log-bridge.service.js';

function createService() {
  const gateway = { broadcastChannel: vi.fn() };
  const service = new NodeLogBridgeService(gateway as any);
  return { service, gateway };
}

function pushEntry(service: NodeLogBridgeService, raw: string, isStderr = false) {
  (service as any).broadcast(raw, isStderr);
}

describe('NodeLogBridgeService', () => {
  let service: NodeLogBridgeService;
  let gateway: { broadcastChannel: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    ({ service, gateway } = createService());
  });

  describe('parseNestjsLog', () => {
    it('should parse a NestJS LOG line and map to INFO', () => {
      pushEntry(service, '[Nest] 100  - 04/23/2026, 2:15:30 PM     LOG [AppModule] Initialized');
      const buf = service.getLogBuffer();
      expect(buf).toHaveLength(1);
      expect(buf[0].level).toBe('INFO');
      expect(buf[0].context).toBe('AppModule');
      expect(buf[0].message).toBe('Initialized');
    });

    it('should parse a NestJS ERROR line', () => {
      pushEntry(service, '[Nest] 200  - 01/01/2026, 8:00:00 AM     ERROR [ExFilter] Fail');
      expect(service.getLogBuffer()[0].level).toBe('ERROR');
      expect(service.getLogBuffer()[0].context).toBe('ExFilter');
    });

    it('should parse a NestJS VERBOSE line as DEBUG', () => {
      pushEntry(service, '[Nest] 1  - 01/01/2026, 1:00:00 AM     VERBOSE [Router] Route mapped');
      expect(service.getLogBuffer()[0].level).toBe('DEBUG');
    });

    it('should strip ANSI codes before parsing', () => {
      pushEntry(service, '\x1b[32m[Nest] 100  - 04/23/2026, 2:15:30 PM     LOG [Boot] OK\x1b[0m');
      const entry = service.getLogBuffer()[0];
      expect(entry.level).toBe('INFO');
      expect(entry.context).toBe('Boot');
    });
  });

  describe('stderr default level', () => {
    it('should default to ERROR for non-NestJS stderr lines', () => {
      pushEntry(service, 'Something went wrong', true);
      expect(service.getLogBuffer()[0].level).toBe('ERROR');
    });

    it('should default to INFO for non-NestJS stdout lines', () => {
      pushEntry(service, 'Hello world', false);
      expect(service.getLogBuffer()[0].level).toBe('INFO');
    });
  });

  describe('buffer cap', () => {
    it('should cap buffer at 500 entries', () => {
      for (let i = 0; i < 600; i++) {
        pushEntry(service, `line ${i}`);
      }
      const buf = service.getLogBuffer();
      expect(buf.length).toBe(500);
      expect(buf[0].message).toBe('line 100');
      expect(buf[499].message).toBe('line 599');
    });
  });

  describe('getFilteredBuffer', () => {
    beforeEach(() => {
      pushEntry(service, '[Nest] 1  - 01/01/2026, 1:00:00 AM     ERROR [Svc] db error');
      pushEntry(service, '[Nest] 1  - 01/01/2026, 1:00:01 AM     LOG [Svc] started');
      pushEntry(service, '[Nest] 1  - 01/01/2026, 1:00:02 AM     WARN [Svc] slow query');
    });

    it('should filter by level', () => {
      const result = service.getFilteredBuffer(['ERROR']);
      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('db error');
    });

    it('should filter by multiple levels', () => {
      const result = service.getFilteredBuffer(['ERROR', 'WARN']);
      expect(result).toHaveLength(2);
    });

    it('should filter by keyword', () => {
      const result = service.getFilteredBuffer(undefined, 'slow');
      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('slow query');
    });

    it('should combine level and keyword filters', () => {
      const result = service.getFilteredBuffer(['INFO'], 'started');
      expect(result).toHaveLength(1);
    });

    it('should return all when no filters', () => {
      expect(service.getFilteredBuffer()).toHaveLength(3);
    });

    it('should be case-insensitive for levels', () => {
      const result = service.getFilteredBuffer(['error']);
      expect(result).toHaveLength(1);
    });
  });

  describe('broadcast', () => {
    it('should call gateway.broadcastChannel', () => {
      pushEntry(service, 'test message');
      expect(gateway.broadcastChannel).toHaveBeenCalledTimes(1);
      const callArgs = gateway.broadcastChannel.mock.calls[0];
      expect(callArgs[1]).toHaveProperty('data');
      expect(callArgs[1].data).toHaveProperty('message', 'test message');
    });

    it('should not throw when gateway throws', () => {
      gateway.broadcastChannel.mockImplementation(() => { throw new Error('not ready'); });
      expect(() => pushEntry(service, 'test')).not.toThrow();
    });
  });
});
