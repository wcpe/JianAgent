import { describe, it, expect } from 'vitest';
import { resolveNumericParam } from '../script/script-executor.js';

describe('resolveNumericParam', () => {
  it('returns the number when value is a number', () => {
    expect(resolveNumericParam(5, 0)).toBe(5);
    expect(resolveNumericParam(3.14, 0)).toBe(3.14);
    expect(resolveNumericParam(0, 1)).toBe(0);
  });

  it('parses a numeric string', () => {
    expect(resolveNumericParam('10', 0)).toBe(10);
    expect(resolveNumericParam('2.5', 0)).toBe(2.5);
  });

  it('returns fallback for non-numeric string', () => {
    expect(resolveNumericParam('abc', 7)).toBe(7);
  });

  it('treats empty string as 0 (numeric coercion)', () => {
    expect(resolveNumericParam('', 3)).toBe(0);
  });

  it('returns fallback for null/undefined', () => {
    expect(resolveNumericParam(null, 5)).toBe(5);
    expect(resolveNumericParam(undefined, 8)).toBe(8);
  });

  it('resolves range "3~8" to a number within bounds', () => {
    for (let i = 0; i < 50; i++) {
      const result = resolveNumericParam('3~8', 0);
      expect(result).toBeGreaterThanOrEqual(3);
      expect(result).toBeLessThan(8);
    }
  });

  it('resolves float range "0.5~2.0"', () => {
    for (let i = 0; i < 50; i++) {
      const result = resolveNumericParam('0.5~2.0', 0);
      expect(result).toBeGreaterThanOrEqual(0.5);
      expect(result).toBeLessThan(2.0);
    }
  });

  it('resolves negative range "-5~5"', () => {
    for (let i = 0; i < 50; i++) {
      const result = resolveNumericParam('-5~5', 0);
      expect(result).toBeGreaterThanOrEqual(-5);
      expect(result).toBeLessThan(5);
    }
  });

  it('handles range with spaces "3 ~ 8"', () => {
    for (let i = 0; i < 20; i++) {
      const result = resolveNumericParam('3 ~ 8', 0);
      expect(result).toBeGreaterThanOrEqual(3);
      expect(result).toBeLessThan(8);
    }
  });

  it('falls back for boolean or object values', () => {
    expect(resolveNumericParam(true, 4)).toBe(4);
    expect(resolveNumericParam({}, 6)).toBe(6);
    expect(resolveNumericParam([], 9)).toBe(9);
  });
});
