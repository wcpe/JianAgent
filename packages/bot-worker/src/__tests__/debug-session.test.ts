import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DebugSession } from '../debug/debug-session.js';
import { BehaviorEngine } from '../behavior/behavior-engine.js';

function mockBotInstance(overrides: Record<string, unknown> = {}): any {
  return {
    name: 'test_bot',
    state: 'CONNECTED',
    bot: {
      entity: { position: { x: 0, y: 64, z: 0, offset: vi.fn() }, yaw: 0, pitch: 0, onGround: true },
      health: 20,
      food: 20,
      inventory: { items: () => [] },
      chat: vi.fn(),
      setControlState: vi.fn(),
    },
    currentBehavior: null,
    ...overrides,
  };
}

describe('DebugSession', () => {
  let engine: BehaviorEngine;
  let outputFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    engine = new BehaviorEngine();
    outputFn = vi.fn();
  });

  it('enter() sets state to DEBUGGING and outputs message', async () => {
    const instance = mockBotInstance();
    const session = new DebugSession(instance, engine, outputFn);
    await session.enter();
    expect(instance.state).toBe('DEBUGGING');
    expect(outputFn).toHaveBeenCalledWith('test_bot', expect.stringContaining('debug mode'));
  });

  it('executeCommand() calls debug command and outputs result', async () => {
    const instance = mockBotInstance();
    const session = new DebugSession(instance, engine, outputFn);
    await session.enter();
    await session.executeCommand('.help');
    expect(outputFn).toHaveBeenCalledWith('test_bot', expect.stringContaining('.pos'));
  });

  it('exit() restores state and outputs exit message', async () => {
    const instance = mockBotInstance();
    const session = new DebugSession(instance, engine, outputFn);
    await session.enter();
    await session.exit();
    expect(instance.state).toBe('SPAWNED');
    expect(outputFn).toHaveBeenCalledWith('test_bot', expect.stringContaining('Exited'));
  });

  it('executeCommand with no bot outputs error', async () => {
    const instance = mockBotInstance({ bot: null });
    const session = new DebugSession(instance, engine, outputFn);
    await session.executeCommand('.pos');
    expect(outputFn).toHaveBeenCalledWith('test_bot', expect.stringContaining('not connected'));
  });
});
