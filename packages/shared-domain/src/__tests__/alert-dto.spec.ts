import { describe, it, expect } from 'vitest';
import { AlertLevel, AlertMetric, AlertOperator } from '../index.js';

describe('AlertLevel', () => {
  it('should have all levels', () => {
    expect(AlertLevel.INFO).toBe('INFO');
    expect(AlertLevel.WARNING).toBe('WARNING');
    expect(AlertLevel.CRITICAL).toBe('CRITICAL');
  });
});

describe('AlertMetric', () => {
  it('should have expected metrics', () => {
    expect(AlertMetric.TPS).toBe('TPS');
    expect(AlertMetric.MSPT).toBe('MSPT');
    expect(AlertMetric.MEMORY_USAGE).toBe('MEMORY_USAGE');
    expect(AlertMetric.BOT_DISCONNECT_RATE).toBe('BOT_DISCONNECT_RATE');
  });
});

describe('AlertOperator', () => {
  it('should have all operators', () => {
    expect(AlertOperator.LESS_THAN).toBe('LESS_THAN');
    expect(AlertOperator.GREATER_THAN).toBe('GREATER_THAN');
    expect(AlertOperator.EQUALS).toBe('EQUALS');
  });
});
