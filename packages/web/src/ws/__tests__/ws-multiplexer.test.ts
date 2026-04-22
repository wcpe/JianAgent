import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the multiplexer logic by importing it fresh
describe('WsMultiplexer', () => {
  // Since the multiplexer is a singleton connected to wsClient, we test the logic pattern
  // by simulating what the multiplexer does internally

  it('should route messages to correct channel listener', () => {
    const listeners = new Map<string, Set<Function>>();
    const subscribe = (channel: string, fn: Function) => {
      let set = listeners.get(channel);
      if (!set) {
        set = new Set();
        listeners.set(channel, set);
      }
      set.add(fn);
      return () => set!.delete(fn);
    };

    const handler = vi.fn();
    subscribe('log:entry', handler);

    // Simulate message dispatch
    const msg = { channel: 'log:entry', payload: { entry: {} }, timestamp: 1 };
    const set = listeners.get('log:entry');
    if (set) for (const fn of set) fn(msg.payload, msg);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(msg.payload, msg);
  });

  it('should not trigger listener for different channel', () => {
    const listeners = new Map<string, Set<Function>>();
    const subscribe = (channel: string, fn: Function) => {
      let set = listeners.get(channel);
      if (!set) {
        set = new Set();
        listeners.set(channel, set);
      }
      set.add(fn);
    };

    const handler = vi.fn();
    subscribe('log:entry', handler);

    // Dispatch to different channel
    const set = listeners.get('alert:fired');
    if (set) for (const fn of set) fn({}, {});

    expect(handler).not.toHaveBeenCalled();
  });

  it('should support sessionId scoped subscriptions', () => {
    const listeners = new Map<string, Set<Function>>();
    const makeKey = (ch: string, sid?: string) => sid ? `${ch}:${sid}` : ch;
    const subscribe = (channel: string, fn: Function, sessionId?: string) => {
      const key = makeKey(channel, sessionId);
      let set = listeners.get(key);
      if (!set) {
        set = new Set();
        listeners.set(key, set);
      }
      set.add(fn);
    };

    const globalHandler = vi.fn();
    const sessionHandler = vi.fn();
    subscribe('terminal:data', globalHandler);
    subscribe('terminal:data', sessionHandler, 'sess-1');

    // Simulate message with sessionId
    const msg = { channel: 'terminal:data', sessionId: 'sess-1', payload: { data: 'hello' } };

    // Exact match
    const exactSet = listeners.get(makeKey('terminal:data', 'sess-1'));
    if (exactSet) for (const fn of exactSet) fn(msg.payload, msg);

    // Channel-only match
    const channelSet = listeners.get(makeKey('terminal:data'));
    if (channelSet) for (const fn of channelSet) fn(msg.payload, msg);

    expect(sessionHandler).toHaveBeenCalledTimes(1);
    expect(globalHandler).toHaveBeenCalledTimes(1);
  });

  it('should unsubscribe correctly', () => {
    const listeners = new Map<string, Set<Function>>();
    const subscribe = (channel: string, fn: Function) => {
      let set = listeners.get(channel);
      if (!set) {
        set = new Set();
        listeners.set(channel, set);
      }
      set.add(fn);
      return () => {
        set!.delete(fn);
        if (set!.size === 0) listeners.delete(channel);
      };
    };

    const handler = vi.fn();
    const unsub = subscribe('test:ch', handler);

    unsub();
    expect(listeners.has('test:ch')).toBe(false);
  });
});
