import { describe, it, expect } from 'vitest';
import { BehaviorFactory } from '../behavior/behavior-factory.js';

describe('BehaviorFactory', () => {
  it('should create idle behavior', () => {
    const b = BehaviorFactory.create('idle');
    expect(b.name).toBe('idle');
  });

  it('should create move-random behavior', () => {
    const b = BehaviorFactory.create('move-random');
    expect(b.name).toBe('move-random');
  });

  it('should create chat behavior', () => {
    const b = BehaviorFactory.create('chat');
    expect(b.name).toBe('chat');
  });

  it('should create gather behavior', () => {
    const b = BehaviorFactory.create('gather');
    expect(b.name).toBe('gather');
  });

  it('should throw for unknown behavior', () => {
    expect(() => BehaviorFactory.create('nope')).toThrow();
  });

  it('should list available names', () => {
    const names = BehaviorFactory.availableNames();
    expect(names).toContain('idle');
    expect(names).toContain('move-random');
    expect(names).toContain('chat');
    expect(names).toContain('gather');
  });
});
