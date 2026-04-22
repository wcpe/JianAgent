import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BotConnector } from '../lifecycle/bot-connector.js';
import { BotState } from '@jian-agent/shared-domain';
import type { BotRegistry } from '../registry/bot-registry.js';
import type { BotHealthChecker } from '../lifecycle/bot-health.js';

vi.mock('mineflayer', () => ({
  default: {
    createBot: vi.fn(() => {
      const listeners = new Map<string, Function[]>();
      const bot: any = {
        on: vi.fn((evt: string, fn: Function) => {
          const list = listeners.get(evt) ?? [];
          list.push(fn);
          listeners.set(evt, list);
        }),
        once: vi.fn((evt: string, fn: Function) => {
          const list = listeners.get(evt) ?? [];
          list.push(fn);
          listeners.set(evt, list);
        }),
        removeAllListeners: vi.fn(),
        quit: vi.fn(),
        _client: {
          on: vi.fn(),
          once: vi.fn(),
          removeAllListeners: vi.fn(),
        },
        _listeners: listeners,
      };
      return bot;
    }),
  },
}));

function createMockRegistry(): BotRegistry & { store: Map<string, any> } {
  const store = new Map<string, any>();
  return {
    store,
    get: vi.fn((name: string) => store.get(name)),
    add: vi.fn((info: any) => store.set(info.name, info)),
    remove: vi.fn((name: string) => store.delete(name)),
    names: vi.fn(() => [...store.keys()]),
    all: vi.fn(() => [...store.values()]),
    size: vi.fn(() => store.size),
  } as any;
}

function createMockHealthChecker(): BotHealthChecker {
  return {
    recordHeartbeat: vi.fn(),
    remove: vi.fn(),
    isHealthy: vi.fn().mockReturnValue(true),
  } as any;
}

describe('BotConnector', () => {
  let connector: BotConnector;
  let registry: ReturnType<typeof createMockRegistry>;
  let healthChecker: ReturnType<typeof createMockHealthChecker>;
  let onEvent: ReturnType<typeof vi.fn>;

  const defaultOptions = {
    serverHost: 'play.example.com',
    serverPort: 25565,
    connectTimeoutMs: 30_000,
    reconnectEnabled: false,
    reconnectMaxRetries: 0,
    autoRespawn: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    healthChecker = createMockHealthChecker();
    onEvent = vi.fn();
    connector = new BotConnector(registry, healthChecker, onEvent);
  });

  it('should create a bot and register it', async () => {
    await connector.connect('TestBot', defaultOptions);
    expect(registry.add).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'TestBot',
        state: BotState.CONNECTING,
      }),
    );
  });

  it('should clean up existing bot before reconnecting', async () => {
    await connector.connect('TestBot', defaultOptions);
    const firstBot = registry.store.get('TestBot')!.bot;

    await connector.connect('TestBot', defaultOptions);
    expect(firstBot.removeAllListeners).toHaveBeenCalled();
    expect(firstBot._client.removeAllListeners).toHaveBeenCalled();
    expect(firstBot.quit).toHaveBeenCalled();
  });

  it('disconnect should clean bot and _client listeners', async () => {
    await connector.connect('TestBot', defaultOptions);
    const bot = registry.store.get('TestBot')!.bot;

    connector.disconnect('TestBot');
    expect(bot.removeAllListeners).toHaveBeenCalled();
    expect(bot._client.removeAllListeners).toHaveBeenCalled();
    expect(bot.quit).toHaveBeenCalled();
    expect(registry.store.get('TestBot')!.state).toBe(BotState.STOPPED);
  });

  it('disconnect should remove health checker entry', async () => {
    await connector.connect('TestBot', defaultOptions);
    connector.disconnect('TestBot');
    expect(healthChecker.remove).toHaveBeenCalledWith('TestBot');
  });

  it('disconnectAll should disconnect every registered bot', async () => {
    await connector.connect('Bot1', defaultOptions);
    await connector.connect('Bot2', defaultOptions);
    connector.disconnectAll();
    expect(registry.store.get('Bot1')!.state).toBe(BotState.STOPPED);
    expect(registry.store.get('Bot2')!.state).toBe(BotState.STOPPED);
  });

  it('error listener should include host:port in event message', async () => {
    await connector.connect('TestBot', defaultOptions);
    const bot = registry.store.get('TestBot')!.bot;

    // Find the error callback registered via bot.on('error', ...)
    const errorCalls = (bot.on as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call: any[]) => call[0] === 'error',
    );
    expect(errorCalls.length).toBeGreaterThan(0);
    const errorHandler = errorCalls[0][1] as (err: Error) => void;

    errorHandler(new Error('ECONNRESET'));
    expect(onEvent).toHaveBeenCalledWith(
      'TestBot',
      'ERROR',
      expect.stringContaining('play.example.com:25565'),
    );
  });

  it('_client error listener should include host:port in event message', async () => {
    await connector.connect('TestBot', defaultOptions);
    const bot = registry.store.get('TestBot')!.bot;

    const clientErrorCalls = (bot._client.on as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call: any[]) => call[0] === 'error',
    );
    expect(clientErrorCalls.length).toBeGreaterThan(0);
    const clientErrorHandler = clientErrorCalls[0][1] as (err: Error) => void;

    clientErrorHandler(new Error('ECONNRESET'));
    expect(onEvent).toHaveBeenCalledWith(
      'TestBot',
      'ERROR',
      expect.stringContaining('ECONNRESET'),
    );
  });

  it('disconnect should not throw if bot has no _client', async () => {
    await connector.connect('TestBot', defaultOptions);
    const info = registry.store.get('TestBot')!;
    delete info.bot._client;
    expect(() => connector.disconnect('TestBot')).not.toThrow();
  });
});
