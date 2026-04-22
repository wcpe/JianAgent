import { describe, it, expect } from 'vitest';
import type { ResourceRefDto, TaskStatusDto } from '@jian-agent/shared-domain';
import {
  PLUGIN_PROTOCOL_VERSION,
  PluginBridgeChannel,
  createBridgeMessage,
} from '../plugin-events.js';
import type {
  HandshakeRequestPayload,
  HandshakeResponsePayload,
  SnapshotPushPayload,
  EventPushPayload,
  CommandRequestPayload,
  CommandResponsePayload,
} from '../plugin-events.js';

const serverRef: ResourceRefDto = {
  id: 'srv_1',
  kind: 'SERVER',
  name: 'test-server',
};

describe('Plugin protocol constants', () => {
  it('should define PLUGIN_PROTOCOL_VERSION', () => {
    expect(PLUGIN_PROTOCOL_VERSION).toBe(2);
  });

  it('should define all bridge channels', () => {
    expect(PluginBridgeChannel.HANDSHAKE).toBe('resource:plugin:handshake');
    expect(PluginBridgeChannel.SNAPSHOT).toBe('resource:plugin:snapshot');
    expect(PluginBridgeChannel.EVENT).toBe('resource:plugin:event');
    expect(PluginBridgeChannel.COMMAND).toBe('resource:plugin:command');
    expect(PluginBridgeChannel.COMMAND_RESULT).toBe('resource:plugin:command-result');
    expect(PluginBridgeChannel.STATUS).toBe('resource:plugin:status');
  });
});

describe('createBridgeMessage', () => {
  it('should create message with protocolVersion', () => {
    const msg = createBridgeMessage(PluginBridgeChannel.HANDSHAKE, { test: 1 });
    expect(msg.channel).toBe('resource:plugin:handshake');
    expect(msg.protocolVersion).toBe(PLUGIN_PROTOCOL_VERSION);
    expect(msg.payload).toEqual({ test: 1 });
    expect(msg.timestamp).toBeDefined();
  });
});

describe('Payload types structural checks', () => {
  it('HandshakeRequestPayload', () => {
    const p: HandshakeRequestPayload = {
      protocolVersion: 2,
      pluginVersion: '1.0.0',
      serverVersion: '1.21.1',
      runtimeKind: 'paper-1.21+',
      serverId: 'srv_1',
      resourceRef: serverRef,
    };
    expect(p.protocolVersion).toBe(2);
    expect(p.runtimeKind).toBe('paper-1.21+');
    expect(p.resourceRef.id).toBe('srv_1');
  });

  it('HandshakeResponsePayload accepted', () => {
    const p: HandshakeResponsePayload = {
      accepted: true,
    };
    expect(p.accepted).toBe(true);
  });

  it('HandshakeResponsePayload with taskStatus', () => {
    const taskStatus: TaskStatusDto = {
      taskId: 'task-1',
      state: 'COMPLETED',
      progress: 100,
      error: null,
      attempt: 1,
      maxAttempts: 1,
      retryable: false,
      resumeToken: null,
      failureClass: null,
    };
    const p: HandshakeResponsePayload = {
      accepted: true,
      taskStatus,
    };
    expect(p.taskStatus?.state).toBe('COMPLETED');
  });

  it('SnapshotPushPayload', () => {
    const p: SnapshotPushPayload = {
      serverId: 'srv_1',
      resourceRef: serverRef,
      runtimeKind: 'paper-1.21+',
      capabilityMatrix: ['players', 'plugins', 'world-events'],
      tps: 20.0,
      mspt: 12.5,
      onlinePlayers: 10,
      maxPlayers: 100,
      loadedChunks: 256,
      entityCount: 500,
      worldCount: 3,
      freeMemoryMb: 2048,
      totalMemoryMb: 4096,
      uptime: '01:30:00',
    };
    expect(p.tps).toBe(20.0);
    expect(p.capabilityMatrix).toContain('players');
    expect(p.resourceRef.kind).toBe('SERVER');
  });

  it('EventPushPayload with taskStatus', () => {
    const taskStatus: TaskStatusDto = {
      taskId: 'task-2',
      state: 'RUNNING',
      progress: 50,
      error: null,
      attempt: 1,
      maxAttempts: 1,
      retryable: false,
      resumeToken: null,
      failureClass: null,
    };
    const p: EventPushPayload = {
      serverId: 'srv_1',
      resourceRef: serverRef,
      eventType: 'PLAYER_JOIN',
      data: { player: 'Steve' },
      taskStatus,
    };
    expect(p.eventType).toBe('PLAYER_JOIN');
    expect(p.taskStatus?.progress).toBe(50);
  });

  it('CommandRequestPayload', () => {
    const req: CommandRequestPayload = {
      requestId: 'r1',
      action: 'TELEPORT',
      params: { target: 'Steve' },
      resourceRef: serverRef,
    };
    expect(req.action).toBe('TELEPORT');
    expect(req.resourceRef.id).toBe('srv_1');
  });

  it('CommandResponsePayload with taskStatus', () => {
    const taskStatus: TaskStatusDto = {
      taskId: 'r1',
      state: 'COMPLETED',
      progress: 100,
      error: null,
      attempt: 1,
      maxAttempts: 1,
      retryable: false,
      resumeToken: null,
      failureClass: null,
    };
    const res: CommandResponsePayload = {
      requestId: 'r1',
      success: true,
      message: 'done',
      taskStatus,
    };
    expect(res.success).toBe(true);
    expect(res.taskStatus?.state).toBe('COMPLETED');
  });
});
