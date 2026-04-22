import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IpcHandler } from '../ipc/ipc-handler.js';
import { IpcCommand } from '@jian-agent/shared-protocol';

describe('IpcHandler', () => {
  it('should dispatch PING', () => {
    const cb = vi.fn();
    const handler = new IpcHandler({ onPing: cb });
    handler.handle({ type: IpcCommand.PING, payload: { timestamp: 1 } });
    expect(cb).toHaveBeenCalledWith({ timestamp: 1 });
  });

  it('should dispatch CREATE_BOTS', () => {
    const cb = vi.fn();
    const handler = new IpcHandler({ onCreateBots: cb });
    handler.handle({ type: IpcCommand.CREATE_BOTS, payload: { names: ['a'] } });
    expect(cb).toHaveBeenCalledWith({ names: ['a'] });
  });

  it('should dispatch SET_BEHAVIOR', () => {
    const cb = vi.fn();
    const handler = new IpcHandler({ onSetBehavior: cb });
    handler.handle({ type: IpcCommand.SET_BEHAVIOR, payload: { botName: 'b', behaviorName: 'idle' } });
    expect(cb).toHaveBeenCalledWith({ botName: 'b', behaviorName: 'idle' });
  });

  it('should dispatch STOP_BOTS', () => {
    const cb = vi.fn();
    const handler = new IpcHandler({ onStopBots: cb });
    handler.handle({ type: IpcCommand.STOP_BOTS, payload: { names: ['a'] } });
    expect(cb).toHaveBeenCalledWith({ names: ['a'] });
  });

  it('should dispatch SHUTDOWN', () => {
    const cb = vi.fn();
    const handler = new IpcHandler({ onShutdown: cb });
    handler.handle({ type: IpcCommand.SHUTDOWN, payload: {} });
    expect(cb).toHaveBeenCalled();
  });

  it('should ignore unknown commands', () => {
    const handler = new IpcHandler({});
    expect(() => handler.handle({ type: 'unknown-cmd' as any, payload: {} })).not.toThrow();
  });
});
