import { describe, it, expect, vi } from 'vitest';
import { executeDebugCommand } from '../debug/debug-command.js';

function mockBot(overrides: Record<string, unknown> = {}): any {
  return {
    entity: {
      position: { x: 10.5, y: 64.0, z: -20.3, offset: vi.fn() },
      yaw: 1.57,
      pitch: -0.5,
      onGround: true,
    },
    health: 18,
    food: 16,
    inventory: { items: () => [{ name: 'stone', count: 64 }, { name: 'diamond', count: 3 }] },
    chat: vi.fn(),
    setControlState: vi.fn(),
    ...overrides,
  };
}

describe('executeDebugCommand', () => {
  it('.pos returns position', () => {
    const result = executeDebugCommand(mockBot(), '.pos');
    expect(result.success).toBe(true);
    expect(result.output).toContain('10.5');
    expect(result.output).toContain('-20.3');
  });

  it('.health returns health and food', () => {
    const result = executeDebugCommand(mockBot(), '.health');
    expect(result.success).toBe(true);
    expect(result.output).toContain('18/20');
    expect(result.output).toContain('16/20');
  });

  it('.inv returns inventory items', () => {
    const result = executeDebugCommand(mockBot(), '.inv');
    expect(result.success).toBe(true);
    expect(result.output).toContain('stone x64');
    expect(result.output).toContain('diamond x3');
  });

  it('.inv with empty inventory', () => {
    const bot = mockBot({ inventory: { items: () => [] } });
    const result = executeDebugCommand(bot, '.inv');
    expect(result.output).toContain('(empty)');
  });

  it('.look returns yaw and pitch', () => {
    const result = executeDebugCommand(mockBot(), '.look');
    expect(result.success).toBe(true);
    expect(result.output).toContain('1.57');
  });

  it('.chat sends message', () => {
    const bot = mockBot();
    const result = executeDebugCommand(bot, '.chat hello world');
    expect(result.success).toBe(true);
    expect(bot.chat).toHaveBeenCalledWith('hello world');
  });

  it('.chat without message returns error', () => {
    const result = executeDebugCommand(mockBot(), '.chat');
    expect(result.success).toBe(false);
    expect(result.output).toContain('Usage');
  });

  it('.jump calls setControlState', () => {
    const bot = mockBot();
    const result = executeDebugCommand(bot, '.jump');
    expect(result.success).toBe(true);
    expect(bot.setControlState).toHaveBeenCalledWith('jump', true);
  });

  it('.help lists all commands', () => {
    const result = executeDebugCommand(mockBot(), '.help');
    expect(result.success).toBe(true);
    expect(result.output).toContain('.pos');
    expect(result.output).toContain('.health');
  });

  it('unknown command returns error', () => {
    const result = executeDebugCommand(mockBot(), '.unknown');
    expect(result.success).toBe(false);
    expect(result.output).toContain('Unknown command');
  });

  it('handles thrown errors gracefully', () => {
    const bot = mockBot();
    bot.health = undefined;
    Object.defineProperty(bot, 'health', {
      get() { throw new Error('disconnected'); },
    });
    const result = executeDebugCommand(bot, '.health');
    expect(result.success).toBe(false);
    expect(result.output).toContain('Error');
  });
});
