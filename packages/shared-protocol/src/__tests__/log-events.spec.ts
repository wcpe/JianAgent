import { describe, it, expect } from 'vitest';
import { LogChannel, createLogEntryMessage } from '../log-events.js';
import type { LogEntryDto } from '@jian-agent/shared-domain';

describe('LogChannel', () => {
  it('should have expected channels', () => {
    expect(LogChannel.LOG_ENTRY).toBe('resource:log:entry');
    expect(LogChannel.LOG_STREAM).toBe('resource:log:stream');
  });
});

describe('createLogEntryMessage', () => {
  it('should create a valid message', () => {
    const entry: LogEntryDto = {
      id: 1,
      hostId: 'host-1',
      hostName: 'Test Host',
      hostType: 'local',
      sourceFile: '/var/log/test.log',
      timestamp: '2026-01-01T00:00:00Z',
      level: 'INFO',
      content: 'Server started',
      rawLine: '[INFO] Server started',
    };
    const msg = createLogEntryMessage(entry);
    expect(msg.channel).toBe('resource:log:entry');
    expect(msg.payload.entry).toEqual(entry);
    expect(msg.timestamp).toBeDefined();
  });
});
