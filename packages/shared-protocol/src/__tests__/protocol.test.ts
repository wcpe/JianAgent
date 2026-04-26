import { describe, it, expect } from 'vitest';
import {
  PROTOCOL_VERSION,
  createWsMessage,
  WsChannel,
} from '../index.js';

describe('PROTOCOL_VERSION', () => {
  it('should be a positive integer', () => {
    expect(PROTOCOL_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(PROTOCOL_VERSION)).toBe(true);
  });
});

describe('createWsMessage', () => {
  it('should create a message with required fields', () => {
    const msg = createWsMessage(WsChannel.RESOURCE_SERVER_STATUS, { state: 'RUNNING' });
    expect(msg.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(msg.channel).toBe(WsChannel.RESOURCE_SERVER_STATUS);
    expect(msg.payload).toEqual({ state: 'RUNNING' });
    expect(typeof msg.timestamp).toBe('number');
  });

  it('should include optional sessionId', () => {
    const msg = createWsMessage(WsChannel.TERMINAL_SESSION_DATA, { data: 'hello' }, 'sess-1');
    expect(msg.sessionId).toBe('sess-1');
  });

  it('should only expose unified channel names', () => {
    expect('SERVER_STATUS' in WsChannel).toBe(false);
    expect('TERMINAL_DATA' in WsChannel).toBe(false);
  });
});
