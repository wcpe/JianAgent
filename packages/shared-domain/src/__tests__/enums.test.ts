import { describe, it, expect } from 'vitest';
import {
  ServerState,
  BotState,
  SessionState,
  PhaseType,
  ProbeStatus,
  RoleLevel,
  AlertLevel,
  ResourceKind,
  TaskState,
  TerminalSessionState,
  PluginInstallState,
} from '../index.js';
import type { ResourceRefDto, TaskStatusDto } from '../index.js';

describe('ServerState', () => {
  it('should have all required states', () => {
    expect(ServerState.NOT_CONFIGURED).toBe('NOT_CONFIGURED');
    expect(ServerState.STOPPED).toBe('STOPPED');
    expect(ServerState.STARTING).toBe('STARTING');
    expect(ServerState.RUNNING).toBe('RUNNING');
    expect(ServerState.STOPPING).toBe('STOPPING');
    expect(ServerState.CRASHED).toBe('CRASHED');
    expect(ServerState.ATTACHED_EXTERNAL).toBe('ATTACHED_EXTERNAL');
    expect(ServerState.UNKNOWN).toBe('UNKNOWN');
  });
});

describe('RoleLevel', () => {
  it('should have ordered numeric levels', () => {
    expect(RoleLevel.VIEWER).toBe(0);
    expect(RoleLevel.OPERATOR).toBe(1);
    expect(RoleLevel.TESTER).toBe(2);
    expect(RoleLevel.TERMINAL).toBe(3);
    expect(RoleLevel.DANGER).toBe(4);
    expect(RoleLevel.ADMIN).toBe(5);
  });

  it('should allow comparison for authorization', () => {
    expect(RoleLevel.ADMIN > RoleLevel.VIEWER).toBe(true);
    expect(RoleLevel.TESTER >= RoleLevel.OPERATOR).toBe(true);
  });
});

describe('BotState', () => {
  it('should have all required states', () => {
    expect(BotState.CREATED).toBe('CREATED');
    expect(BotState.CONNECTING).toBe('CONNECTING');
    expect(BotState.SPAWNED).toBe('SPAWNED');
    expect(BotState.READY).toBe('READY');
    expect(BotState.RUNNING_PHASE).toBe('RUNNING_PHASE');
    expect(BotState.DEBUGGING).toBe('DEBUGGING');
    expect(BotState.DISCONNECTED).toBe('DISCONNECTED');
    expect(BotState.FAILED).toBe('FAILED');
    expect(BotState.STOPPED).toBe('STOPPED');
  });
});

describe('SessionState', () => {
  it('should have all required states', () => {
    expect(SessionState.IDLE).toBe('idle');
    expect(SessionState.PREPARING).toBe('preparing');
    expect(SessionState.STARTING).toBe('starting');
    expect(SessionState.RUNNING).toBe('running');
    expect(SessionState.PAUSED).toBe('paused');
    expect(SessionState.STOPPING).toBe('stopping');
    expect(SessionState.FINISHED).toBe('finished');
    expect(SessionState.ABORTED).toBe('aborted');
    expect(SessionState.FAILED).toBe('failed');
  });
});

describe('PhaseType', () => {
  it('should have all phase types', () => {
    expect(PhaseType.WAITING).toBe('WAITING');
    expect(PhaseType.LOGIN_IDLE).toBe('LOGIN_IDLE');
    expect(PhaseType.LOBBY_GATHER).toBe('LOBBY_GATHER');
    expect(PhaseType.GAME_PREPARE).toBe('GAME_PREPARE');
    expect(PhaseType.GAME_PLAY).toBe('GAME_PLAY');
    expect(PhaseType.GAME_END).toBe('GAME_END');
    expect(PhaseType.RANDOM_WALK).toBe('RANDOM_WALK');
    expect(PhaseType.STRESS_MOVE).toBe('STRESS_MOVE');
    expect(PhaseType.CHAT_SPAM).toBe('CHAT_SPAM');
  });
});

describe('ProbeStatus', () => {
  it('should have all probe statuses', () => {
    expect(ProbeStatus.UNAVAILABLE).toBe('UNAVAILABLE');
    expect(ProbeStatus.CONNECTING).toBe('CONNECTING');
    expect(ProbeStatus.HANDSHAKING).toBe('HANDSHAKING');
    expect(ProbeStatus.READY).toBe('READY');
    expect(ProbeStatus.DISCONNECTED).toBe('DISCONNECTED');
    expect(ProbeStatus.VERSION_MISMATCH).toBe('VERSION_MISMATCH');
  });
});

describe('AlertLevel', () => {
  it('should have INFO, WARNING, CRITICAL', () => {
    expect(AlertLevel.INFO).toBe('INFO');
    expect(AlertLevel.WARNING).toBe('WARNING');
    expect(AlertLevel.CRITICAL).toBe('CRITICAL');
  });
});

describe('ResourceKind', () => {
  it('should have all resource kinds', () => {
    expect(ResourceKind.SERVER).toBe('SERVER');
    expect(ResourceKind.REMOTE_HOST).toBe('REMOTE_HOST');
    expect(ResourceKind.RUNTIME).toBe('RUNTIME');
    expect(ResourceKind.PROBE).toBe('PROBE');
    expect(ResourceKind.BOT).toBe('BOT');
    expect(ResourceKind.SESSION).toBe('SESSION');
  });
});

describe('TaskState', () => {
  it('should have all task states', () => {
    expect(TaskState.PENDING).toBe('PENDING');
    expect(TaskState.RUNNING).toBe('RUNNING');
    expect(TaskState.COMPLETED).toBe('COMPLETED');
    expect(TaskState.FAILED).toBe('FAILED');
    expect(TaskState.CANCELLED).toBe('CANCELLED');
  });
});

describe('TerminalSessionState', () => {
  it('should have all terminal session states', () => {
    expect(TerminalSessionState.CONNECTING).toBe('CONNECTING');
    expect(TerminalSessionState.ACTIVE).toBe('ACTIVE');
    expect(TerminalSessionState.DISCONNECTED).toBe('DISCONNECTED');
    expect(TerminalSessionState.ERROR).toBe('ERROR');
  });
});

describe('ResourceRefDto', () => {
  it('should type-check a valid ResourceRefDto', () => {
    const ref: ResourceRefDto = {
      id: 'srv-1',
      kind: ResourceKind.SERVER,
      name: 'main-server',
    };
    expect(ref.id).toBe('srv-1');
    expect(ref.kind).toBe(ResourceKind.SERVER);
    expect(ref.name).toBe('main-server');
  });
});

describe('TaskStatusDto', () => {
  it('should type-check a valid TaskStatusDto', () => {
    const status: TaskStatusDto = {
      taskId: 'task-42',
      state: TaskState.RUNNING,
      progress: 0.75,
      error: null,
      attempt: 1,
      maxAttempts: 3,
      retryable: true,
      resumeToken: null,
      failureClass: null,
    };
    expect(status.taskId).toBe('task-42');
    expect(status.state).toBe(TaskState.RUNNING);
    expect(status.progress).toBe(0.75);
    expect(status.error).toBeNull();
  });

  it('should support error state', () => {
    const status: TaskStatusDto = {
      taskId: 'task-99',
      state: TaskState.FAILED,
      progress: 0.3,
      error: 'Connection timed out',
      attempt: 2,
      maxAttempts: 3,
      retryable: true,
      resumeToken: 'task-99:attempt:2',
      failureClass: 'network-timeout',
    };
    expect(status.state).toBe(TaskState.FAILED);
    expect(status.error).toBe('Connection timed out');
  });
});

describe('PluginInstallState', () => {
  it('should have all required states', () => {
    expect(PluginInstallState.INSTALLED).toBe('INSTALLED');
    expect(PluginInstallState.DISABLED).toBe('DISABLED');
    expect(PluginInstallState.CORRUPTED).toBe('CORRUPTED');
  });

  it('should have exactly three states', () => {
    const states = Object.values(PluginInstallState);
    expect(states).toHaveLength(3);
    expect(states).toContain('INSTALLED');
    expect(states).toContain('DISABLED');
    expect(states).toContain('CORRUPTED');
  });
});
