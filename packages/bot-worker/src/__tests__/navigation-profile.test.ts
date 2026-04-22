import { describe, expect, it } from 'vitest';
import {
  buildDeterministicOffset,
  resolveExecutionProfile,
  resolveGoalRadius,
} from '../navigation/navigation-profile.js';

describe('navigation-profile', () => {
  it('resolves default execution profile', () => {
    expect(resolveExecutionProfile({})).toEqual({
      navigationProfile: 'pathfinder-balanced',
      scenarioProfile: 'default',
      determinismLevel: 'balanced',
    });
  });

  it('returns stable deterministic offsets for the same input', () => {
    const a = buildDeterministicOffset('bot-1:smoke', 3, 8, 'strict');
    const b = buildDeterministicOffset('bot-1:smoke', 3, 8, 'strict');
    expect(a).toEqual(b);
  });

  it('uses tighter goal radius for strict profiles', () => {
    expect(resolveGoalRadius(resolveExecutionProfile({
      navigationProfile: 'pathfinder-strict',
      determinismLevel: 'strict',
    }))).toBe(1);
  });
});
