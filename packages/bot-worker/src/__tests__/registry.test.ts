import { describe, it, expect, beforeEach } from 'vitest';
import { BotRegistry } from '../registry/bot-registry.js';
import type { BotInstanceInfo } from '../registry/bot-instance.js';

describe('BotRegistry', () => {
  let registry: BotRegistry;

  beforeEach(() => {
    registry = new BotRegistry();
  });

  it('should add and retrieve a bot', () => {
    const info: BotInstanceInfo = {
      name: 'bot_1',
      state: 'CREATED',
      bot: null,
      currentBehavior: null,
      connectedAt: null,
      lastError: null,
      lastDisconnectReason: null,
      deathCount: 0,
    };
    registry.add(info);
    expect(registry.get('bot_1')).toBe(info);
  });

  it('should return undefined for missing bot', () => {
    expect(registry.get('nope')).toBeUndefined();
  });

  it('should remove a bot', () => {
    registry.add({ name: 'b', state: 'CREATED', bot: null, currentBehavior: null, connectedAt: null, lastError: null, lastDisconnectReason: null, deathCount: 0 });
    registry.remove('b');
    expect(registry.get('b')).toBeUndefined();
    expect(registry.size()).toBe(0);
  });

  it('should list all bots and names', () => {
    registry.add({ name: 'a', state: 'CREATED', bot: null, currentBehavior: null, connectedAt: null, lastError: null, lastDisconnectReason: null, deathCount: 0 });
    registry.add({ name: 'b', state: 'CREATED', bot: null, currentBehavior: null, connectedAt: null, lastError: null, lastDisconnectReason: null, deathCount: 0 });
    expect(registry.names()).toEqual(['a', 'b']);
    expect(registry.all()).toHaveLength(2);
    expect(registry.size()).toBe(2);
  });
});
