import { describe, it, expect } from 'vitest';
import { LogLevel, LogSource } from '../index.js';

describe('LogLevel', () => {
  it('should have all levels', () => {
    expect(LogLevel.DEBUG).toBe('DEBUG');
    expect(LogLevel.INFO).toBe('INFO');
    expect(LogLevel.WARN).toBe('WARN');
    expect(LogLevel.ERROR).toBe('ERROR');
  });
});

describe('LogSource', () => {
  it('should have all sources', () => {
    expect(LogSource.SERVER_PROCESS).toBe('SERVER_PROCESS');
    expect(LogSource.BOT_WORKER).toBe('BOT_WORKER');
    expect(LogSource.PLUGIN_PROBE).toBe('PLUGIN_PROBE');
    expect(LogSource.SYSTEM).toBe('SYSTEM');
  });
});
