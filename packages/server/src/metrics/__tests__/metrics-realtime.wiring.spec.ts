import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetricsRealtimeWiring } from '../metrics-realtime.wiring.js';

function createMockGateway() {
  return { broadcastRaw: vi.fn() };
}

function createMockEmitter() {
  const handlers = new Map<string, Function>();
  return {
    on: vi.fn((event: string, handler: Function) => handlers.set(event, handler)),
    removeListener: vi.fn((event: string) => handlers.delete(event)),
    _fire: (event: string, data: unknown) => handlers.get(event)?.(data),
  };
}

function createJmxEmitter() {
  const handlers = new Map<string, Function>();
  return {
    on: vi.fn((event: string, handler: Function) => handlers.set(event, handler)),
    removeListener: vi.fn((event: string) => handlers.delete(event)),
    _fire: (event: string, data: unknown) => handlers.get(event)?.(data),
  };
}

describe('MetricsRealtimeWiring', () => {
  let wiring: MetricsRealtimeWiring;
  let gateway: ReturnType<typeof createMockGateway>;
  let logAggregator: ReturnType<typeof createMockEmitter>;
  let alertEngine: ReturnType<typeof createMockEmitter>;
  let jmxMetrics: ReturnType<typeof createJmxEmitter>;

  beforeEach(() => {
    gateway = createMockGateway();
    logAggregator = createMockEmitter();
    alertEngine = createMockEmitter();
    jmxMetrics = createJmxEmitter();
    const systemMetrics = createMockEmitter();
    wiring = new MetricsRealtimeWiring(gateway as any, logAggregator as any, alertEngine as any, jmxMetrics as any, systemMetrics as any);
  });

  it('should register listeners on init', () => {
    wiring.onModuleInit();
    expect(logAggregator.on).toHaveBeenCalledWith('log.entry', expect.any(Function));
    expect(alertEngine.on).toHaveBeenCalledWith('alert.fired', expect.any(Function));
    expect(jmxMetrics.on).toHaveBeenCalledWith('jmx.snapshot', expect.any(Function));
  });

  it('should broadcast log entry via gateway', () => {
    wiring.onModuleInit();
    const entry = { id: '1', level: 'INFO', message: 'test' };
    logAggregator._fire('log.entry', entry);
    expect(gateway.broadcastRaw).toHaveBeenCalledTimes(1);
    const msg = gateway.broadcastRaw.mock.calls[0][0];
    expect(msg.channel).toBe('resource:log:entry');
    expect(msg.payload.entry).toEqual(entry);
  });

  it('should broadcast alert via gateway', () => {
    wiring.onModuleInit();
    const alert = { id: '2', level: 'CRITICAL', message: 'test alert' };
    alertEngine._fire('alert.fired', alert);
    expect(gateway.broadcastRaw).toHaveBeenCalledTimes(1);
    const msg = gateway.broadcastRaw.mock.calls[0][0];
    expect(msg.channel).toBe('alert:fired');
    expect(msg.payload.alert).toEqual(alert);
  });

  it('should remove listeners on destroy', () => {
    wiring.onModuleInit();
    wiring.onModuleDestroy();
    expect(logAggregator.removeListener).toHaveBeenCalledWith('log.entry', expect.any(Function));
    expect(alertEngine.removeListener).toHaveBeenCalledWith('alert.fired', expect.any(Function));
    expect(jmxMetrics.removeListener).toHaveBeenCalledWith('jmx.snapshot', expect.any(Function));
  });

  it('should broadcast jmx snapshot via gateway', () => {
    wiring.onModuleInit();
    const snapshot = { id: 'j1', serverId: 's1', pid: '123', timestamp: new Date().toISOString() };
    jmxMetrics._fire('jmx.snapshot', snapshot);
    expect(gateway.broadcastRaw).toHaveBeenCalledTimes(1);
    const msg = gateway.broadcastRaw.mock.calls[0][0];
    expect(msg.channel).toBe('resource:metric:summary');
    expect(msg.payload.type).toBe('jmx');
    expect(msg.payload.snapshot).toEqual(snapshot);
  });
});
