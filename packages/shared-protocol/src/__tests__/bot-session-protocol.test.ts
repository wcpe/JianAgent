import { describe, it, expect } from 'vitest';
import {
  WsChannel,
  createWsMessage,
  IpcCommand,
  IpcEvent,
} from '../index.js';

describe('WsChannel unified categories', () => {
  it('should have resource channels', () => {
    expect(WsChannel.RESOURCE_BOT_STATE).toBe('resource:bot:state');
    expect(WsChannel.RESOURCE_SESSION_STATE).toBe('resource:session:state');
    expect(WsChannel.RESOURCE_SERVER_STATUS).toBe('resource:server:status');
    expect(WsChannel.RESOURCE_PLUGIN_STATUS).toBe('resource:plugin:status');
    expect(WsChannel.RESOURCE_WORKER_STATUS).toBe('resource:worker:status');
    expect(WsChannel.RESOURCE_LOCAL_VALIDATION_RUN).toBe('resource:local-validation:run');
    expect(WsChannel.RESOURCE_LOCAL_VALIDATION_STAGE).toBe('resource:local-validation:stage');
    expect(WsChannel.RESOURCE_LOCAL_VALIDATION_ASSERTION).toBe('resource:local-validation:assertion');
    expect(WsChannel.RESOURCE_LOCAL_VALIDATION_EVIDENCE).toBe('resource:local-validation:evidence');
  });

  it('should have task channels', () => {
    expect(WsChannel.TASK_BOT_EVENT).toBe('task:bot:event');
    expect(WsChannel.TASK_SESSION_PHASE).toBe('task:session:phase');
    expect(WsChannel.TASK_SESSION_STATUS).toBe('task:session:status');
    expect(WsChannel.TASK_PHASE_STATUS).toBe('task:phase:status');
    expect(WsChannel.TASK_WORKER_EVENT).toBe('task:worker:event');
  });

  it('should have terminal session channels', () => {
    expect(WsChannel.TERMINAL_SESSION_DATA).toBe('terminal-session:data');
    expect(WsChannel.TERMINAL_SESSION_RESIZE).toBe('terminal-session:resize');
    expect(WsChannel.TERMINAL_SESSION_INPUT).toBe('terminal-session:input');
    expect(WsChannel.TERMINAL_SESSION_BOT_DEBUG).toBe('terminal-session:bot-debug');
  });

  it('should have alert channels', () => {
    expect(WsChannel.ALERT_FIRED).toBe('alert:fired');
    expect(WsChannel.ALERT_ACK).toBe('alert:ack');
    expect(WsChannel.ALERT_SUMMARY).toBe('alert:summary');
  });

  it('should support legacy aliases for backward compatibility', () => {
    expect(WsChannel.BOT_STATE).toBe('bot:state');
    expect(WsChannel.BOT_EVENT).toBe('bot:event');
    expect(WsChannel.SESSION_STATE).toBe('session:state');
    expect(WsChannel.SESSION_PHASE).toBe('session:phase');
    expect(WsChannel.BOT_DEBUG).toBe('bot:debug');
    expect(WsChannel.SERVER_STATUS).toBe('server:status');
    expect(WsChannel.TERMINAL_DATA).toBe('terminal:data');
    expect(WsChannel.TERMINAL_RESIZE).toBe('terminal:resize');
    expect(WsChannel.TERMINAL_INPUT).toBe('terminal:input');
  });
});

describe('IpcCommand', () => {
  it('should have PING', () => {
    expect(IpcCommand.PING).toBe('ping');
  });
  it('should have CREATE_BOTS', () => {
    expect(IpcCommand.CREATE_BOTS).toBe('create-bots');
  });
  it('should have SET_PHASE', () => {
    expect(IpcCommand.SET_PHASE).toBe('set-phase');
  });
  it('should have DEBUG_START', () => {
    expect(IpcCommand.DEBUG_START).toBe('debug-start');
  });
});

describe('IpcEvent', () => {
  it('should have PONG', () => {
    expect(IpcEvent.PONG).toBe('pong');
  });
  it('should have STATE_REPORT', () => {
    expect(IpcEvent.STATE_REPORT).toBe('report-state');
  });
  it('should have EVENT_REPORT', () => {
    expect(IpcEvent.EVENT_REPORT).toBe('report-event');
  });
});
