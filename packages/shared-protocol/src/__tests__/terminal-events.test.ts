import { describe, it, expect } from 'vitest';
import type { ResourceRefDto } from '@jian-agent/shared-domain';
import { PROTOCOL_VERSION } from '../version.js';
import {
  createTerminalDataMessage,
  createTerminalInputMessage,
  createTerminalResizeMessage,
  createMcConsoleMessage,
  createNodeLogMessage,
} from '../terminal-events.js';

const serverRef: ResourceRefDto = {
  id: 'srv-1',
  kind: 'SERVER',
  name: 'test-server',
};

describe('terminal-events factory functions', () => {
  it('createTerminalDataMessage creates correct WsMessage', () => {
    const msg = createTerminalDataMessage('hello', 'sess-1', serverRef);
    expect(msg.channel).toBe('terminal-session:data');
    expect(msg.payload).toEqual({
      sessionId: 'sess-1',
      resourceRef: serverRef,
      sessionState: 'ACTIVE',
      data: 'hello',
    });
    expect(msg.sessionId).toBe('sess-1');
    expect(msg.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(typeof msg.timestamp).toBe('number');
  });

  it('createTerminalInputMessage creates correct WsMessage', () => {
    const msg = createTerminalInputMessage('ls\n', 'sess-1', serverRef);
    expect(msg.channel).toBe('terminal-session:input');
    expect(msg.payload).toEqual({
      sessionId: 'sess-1',
      resourceRef: serverRef,
      sessionState: 'ACTIVE',
      data: 'ls\n',
    });
    expect(msg.sessionId).toBe('sess-1');
  });

  it('createTerminalResizeMessage creates correct WsMessage', () => {
    const msg = createTerminalResizeMessage(120, 30, 'sess-2', serverRef);
    expect(msg.channel).toBe('terminal-session:resize');
    expect(msg.payload).toEqual({
      sessionId: 'sess-2',
      resourceRef: serverRef,
      sessionState: 'ACTIVE',
      cols: 120,
      rows: 30,
    });
    expect(msg.sessionId).toBe('sess-2');
  });

  it('createMcConsoleMessage creates correct WsMessage', () => {
    const msg = createMcConsoleMessage('[INFO] Server started', 'mc-1', serverRef);
    expect(msg.channel).toBe('terminal-session:mc-console');
    expect(msg.payload).toEqual({
      sessionId: 'mc-1',
      resourceRef: serverRef,
      sessionState: 'ACTIVE',
      data: '[INFO] Server started',
    });
  });

  it('createNodeLogMessage creates correct WsMessage', () => {
    const msg = createNodeLogMessage('[NestApplication] started', 'node-1', serverRef);
    expect(msg.channel).toBe('terminal-session:node-log');
    expect(msg.payload).toEqual({
      sessionId: 'node-1',
      resourceRef: serverRef,
      sessionState: 'ACTIVE',
      data: '[NestApplication] started',
    });
  });

  it('supports custom sessionState', () => {
    const msg = createTerminalDataMessage('data', 'sess-1', serverRef, 'CONNECTING');
    expect(msg.payload.sessionState).toBe('CONNECTING');
  });
});
