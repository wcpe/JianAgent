import { describe, it, expect } from 'vitest';
import {
  WsChannel,
  createWsMessage,
  createTerminalDataMessage,
  createTerminalInputMessage,
  createTerminalResizeMessage,
  createMcConsoleMessage,
  createNodeLogMessage,
} from '@jian-agent/shared-protocol';
import type {
  ResourceRefDto,
  TerminalSessionState,
  TaskState,
  ResourceKind,
} from '@jian-agent/shared-domain';

/**
 * Platform-model contract tests.
 *
 * These tests enforce the contract between shared-protocol (channel names,
 * message shapes) and shared-domain (unified DTOs) so that web and server
 * consumers stay in sync when the protocol evolves.
 */
describe('Platform Model Contract', () => {
  // ───────────────────────────────────────────────
  // 1. WsChannel naming convention enforcement
  // ───────────────────────────────────────────────
  describe('WsChannel naming convention', () => {
    const allChannels = Object.entries(WsChannel);
    const unifiedChannels = allChannels;

    it('all unified channel values start with resource:, task:, terminal-session:, or alert:', () => {
      for (const [key, value] of unifiedChannels) {
        const validPrefix =
          value.startsWith('resource:') ||
          value.startsWith('task:') ||
          value.startsWith('terminal-session:') ||
          value.startsWith('alert:');
        expect(
          validPrefix,
          `WsChannel.${key} = "${value}" does not follow unified naming convention`,
        ).toBe(true);
      }
    });

    it('resource:* channels cover server, bot, session, plugin, worker, metric, log', () => {
      const resourceChannels = unifiedChannels.filter(([, v]) =>
        v.startsWith('resource:'),
      );
      const resourceValues = resourceChannels.map(([, v]) => v);

      expect(resourceValues).toContain('resource:server:status');
      expect(resourceValues).toContain('resource:server:output');
      expect(resourceValues).toContain('resource:server:crashed');
      expect(resourceValues).toContain('resource:server:health');
      expect(resourceValues).toContain('resource:bot:state');
      expect(resourceValues).toContain('resource:bot:summary');
      expect(resourceValues).toContain('resource:session:state');
      expect(resourceValues).toContain('resource:plugin:status');
      expect(resourceValues).toContain('resource:plugin:snapshot');
      expect(resourceValues).toContain('resource:java-helper:status');
      expect(resourceValues).toContain('resource:worker:status');
      expect(resourceValues).toContain('resource:metric:summary');
      expect(resourceValues).toContain('resource:log:tail');
      expect(resourceValues).toContain('resource:log:tail:start');
      expect(resourceValues).toContain('resource:log:tail:stop');
      expect(resourceValues).toContain('resource:log:entry');
    });

    it('task:* channels cover bot events, session phases, worker events, control-plane', () => {
      const taskChannels = unifiedChannels.filter(([, v]) =>
        v.startsWith('task:'),
      );
      const taskValues = taskChannels.map(([, v]) => v);

      expect(taskValues).toContain('task:bot:event');
      expect(taskValues).toContain('task:session:status');
      expect(taskValues).toContain('task:session:phase');
      expect(taskValues).toContain('task:phase:status');
      expect(taskValues).toContain('task:worker:event');
      expect(taskValues).toContain('task:control-plane:agent:registered');
      expect(taskValues).toContain('task:control-plane:agent:heartbeat');
    });

    it('terminal-session:* channels cover data, resize, input, mc-console, node-log, bot-debug, ssh', () => {
      const termChannels = unifiedChannels.filter(([, v]) =>
        v.startsWith('terminal-session:'),
      );
      const termValues = termChannels.map(([, v]) => v);

      expect(termValues).toContain('terminal-session:data');
      expect(termValues).toContain('terminal-session:resize');
      expect(termValues).toContain('terminal-session:input');
      expect(termValues).toContain('terminal-session:mc-console');
      expect(termValues).toContain('terminal-session:node-log');
      expect(termValues).toContain('terminal-session:bot-debug');
      expect(termValues).toContain('terminal-session:bot-debug:output');
      expect(termValues).toContain('terminal-session:bot-debug:input');
      expect(termValues).toContain('terminal-session:bot:chat');
      expect(termValues).toContain('terminal-session:ssh:data');
      expect(termValues).toContain('terminal-session:ssh:resize');
    });

    it('no unified channel key contains the word ALIAS or LEGACY', () => {
      for (const [key] of unifiedChannels) {
        expect(key).not.toContain('ALIAS');
        expect(key).not.toContain('LEGACY');
      }
    });

    it('all channel values are unique (no collisions)', () => {
      const values = allChannels.map(([, v]) => v);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  // ───────────────────────────────────────────────
  // 2. WsMessage factory contract
  // ───────────────────────────────────────────────
  describe('createWsMessage contract', () => {
    it('produces messages with protocolVersion, channel, timestamp, payload', () => {
      const msg = createWsMessage(WsChannel.RESOURCE_SERVER_STATUS, {
        state: 'RUNNING',
      });
      expect(msg).toHaveProperty('protocolVersion');
      expect(msg).toHaveProperty('channel', 'resource:server:status');
      expect(msg).toHaveProperty('timestamp');
      expect(msg).toHaveProperty('payload');
      expect(typeof msg.protocolVersion).toBe('number');
      expect(typeof msg.timestamp).toBe('number');
    });

    it('includes sessionId when provided', () => {
      const msg = createWsMessage(
        WsChannel.TERMINAL_SESSION_DATA,
        { data: 'hello' },
        'sess-123',
      );
      expect(msg.sessionId).toBe('sess-123');
    });

    it('omits sessionId when not provided', () => {
      const msg = createWsMessage(WsChannel.ALERT_FIRED, {
        level: 'CRITICAL',
      });
      expect(msg).not.toHaveProperty('sessionId');
    });

    it('uses new unified channel names, not legacy', () => {
      const msg = createWsMessage(WsChannel.RESOURCE_BOT_STATE, {});
      expect(msg.channel).toBe('resource:bot:state');
      expect(msg.channel).not.toBe('bot:state');
    });
  });

  // ───────────────────────────────────────────────
  // 3. Terminal session events contract
  // ───────────────────────────────────────────────
  describe('terminal-session event factories', () => {
    it('createTerminalDataMessage uses TERMINAL_SESSION_DATA channel', () => {
      const msg = createTerminalDataMessage(
        'hello',
        'sess-1',
        { id: 's1', kind: 'SERVER', name: 'test' } as ResourceRefDto,
      );
      expect(msg.channel).toBe('terminal-session:data');
      expect(msg.payload.data).toBe('hello');
      expect(msg.payload.sessionId).toBe('sess-1');
      expect(msg.payload.resourceRef.id).toBe('s1');
    });

    it('createTerminalInputMessage uses TERMINAL_SESSION_INPUT channel', () => {
      const msg = createTerminalInputMessage(
        'ls\n',
        'sess-2',
        { id: 's1', kind: 'SERVER', name: 'test' } as ResourceRefDto,
      );
      expect(msg.channel).toBe('terminal-session:input');
      expect(msg.payload.data).toBe('ls\n');
    });

    it('createTerminalResizeMessage uses TERMINAL_SESSION_RESIZE channel', () => {
      const msg = createTerminalResizeMessage(
        80,
        24,
        'sess-3',
        { id: 's1', kind: 'SERVER', name: 'test' } as ResourceRefDto,
      );
      expect(msg.channel).toBe('terminal-session:resize');
      expect(msg.payload.cols).toBe(80);
      expect(msg.payload.rows).toBe(24);
    });

    it('createMcConsoleMessage uses TERMINAL_SESSION_MC_CONSOLE channel', () => {
      const msg = createMcConsoleMessage(
        'say hello\n',
        's1',
        { id: 's1', kind: 'SERVER', name: 'test' } as ResourceRefDto,
      );
      expect(msg.channel).toBe('terminal-session:mc-console');
    });

    it('createNodeLogMessage uses TERMINAL_SESSION_NODE_LOG channel', () => {
      const msg = createNodeLogMessage(
        'some log line',
        's1',
        { id: 's1', kind: 'SERVER', name: 'test' } as ResourceRefDto,
      );
      expect(msg.channel).toBe('terminal-session:node-log');
    });
  });

  // ───────────────────────────────────────────────
  // 4. Shared-domain unified DTO shapes
  // ───────────────────────────────────────────────
  describe('shared-domain unified DTOs', () => {
    it('ResourceRefDto has id, kind, name fields', () => {
      const ref: ResourceRefDto = {
        id: 's1',
        kind: 'SERVER' as ResourceKind,
        name: 'my-server',
      };
      expect(ref.id).toBe('s1');
      expect(ref.kind).toBe('SERVER');
      expect(ref.name).toBe('my-server');
    });

    it('TerminalSessionState includes CONNECTING, ACTIVE, DISCONNECTED, ERROR', () => {
      const states: TerminalSessionState[] = [
        'CONNECTING',
        'ACTIVE',
        'DISCONNECTED',
        'ERROR',
      ];
      for (const state of states) {
        expect(typeof state).toBe('string');
      }
    });

    it('TaskState includes PENDING, RUNNING, COMPLETED, FAILED, CANCELLED', () => {
      const states: TaskState[] = [
        'PENDING',
        'RUNNING',
        'COMPLETED',
        'FAILED',
        'CANCELLED',
      ];
      for (const state of states) {
        expect(typeof state).toBe('string');
      }
    });

    it('ResourceKind includes SERVER, REMOTE_HOST, RUNTIME, PROBE, BOT, SESSION', () => {
      const kinds: ResourceKind[] = [
        'SERVER',
        'REMOTE_HOST',
        'RUNTIME',
        'PROBE',
        'BOT',
        'SESSION',
      ];
      for (const kind of kinds) {
        expect(typeof kind).toBe('string');
      }
    });
  });

  // ───────────────────────────────────────────────
  // 5. Cross-reference: channel values are consistent
  // ───────────────────────────────────────────────
  describe('channel value cross-references', () => {
    it('WsChannel enum value matches the string used in createWsMessage', () => {
      // Verify that using the enum produces the expected string
      expect(WsChannel.RESOURCE_SERVER_STATUS).toBe('resource:server:status');
      expect(WsChannel.TERMINAL_SESSION_DATA).toBe('terminal-session:data');
      expect(WsChannel.TASK_BOT_EVENT).toBe('task:bot:event');
      expect(WsChannel.ALERT_FIRED).toBe('alert:fired');
    });

    it('legacy channel aliases are removed from WsChannel exports', () => {
      expect('SERVER_STATUS' in WsChannel).toBe(false);
      expect('TERMINAL_DATA' in WsChannel).toBe(false);
      expect('BOT_STATE' in WsChannel).toBe(false);
    });
  });
});
