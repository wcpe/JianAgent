import { PROTOCOL_VERSION } from './version.js';

/**
 * Unified WebSocket channel categories:
 * - resource:* - Server, bot state, session state, plugin, worker, metrics, logs
 * - task:* - Bot events, session phases, worker events, control-plane events  
 * - terminal-session:* - Terminal data, resize, input, debug, SSH terminal
 * - alert:* - Alert events (existing)
 */

export const WsChannel = {
  // Resource channels
  RESOURCE_SERVER_STATUS: 'resource:server:status',
  RESOURCE_SERVER_OUTPUT: 'resource:server:output',
  RESOURCE_SERVER_CRASHED: 'resource:server:crashed',
  RESOURCE_SERVER_HEALTH: 'resource:server:health',
  RESOURCE_LOCAL_VALIDATION_RUN: 'resource:local-validation:run',
  RESOURCE_LOCAL_VALIDATION_STAGE: 'resource:local-validation:stage',
  RESOURCE_LOCAL_VALIDATION_ASSERTION: 'resource:local-validation:assertion',
  RESOURCE_LOCAL_VALIDATION_EVIDENCE: 'resource:local-validation:evidence',
  RESOURCE_BOT_SUMMARY: 'resource:bot:summary',
  RESOURCE_BOT_STATE: 'resource:bot:state',
  RESOURCE_SESSION_STATE: 'resource:session:state',
  RESOURCE_PLUGIN_STATUS: 'resource:plugin:status',
  RESOURCE_PLUGIN_SNAPSHOT: 'resource:plugin:snapshot',
  RESOURCE_JAVA_HELPER_STATUS: 'resource:java-helper:status',
  RESOURCE_WORKER_STATUS: 'resource:worker:status',
  RESOURCE_METRIC_SUMMARY: 'resource:metric:summary',
  RESOURCE_LOG_TAIL: 'resource:log:tail',
  RESOURCE_LOG_TAIL_START: 'resource:log:tail:start',
  RESOURCE_LOG_TAIL_STOP: 'resource:log:tail:stop',
  RESOURCE_LOG_ENTRY: 'resource:log:entry',

  // Task channels
  TASK_BOT_EVENT: 'task:bot:event',
  TASK_SESSION_STATUS: 'task:session:status',
  TASK_SESSION_PHASE: 'task:session:phase',
  TASK_PHASE_STATUS: 'task:phase:status',
  TASK_WORKER_EVENT: 'task:worker:event',
  TASK_CONTROL_PLANE_AGENT_REGISTERED: 'task:control-plane:agent:registered',
  TASK_CONTROL_PLANE_AGENT_HEARTBEAT: 'task:control-plane:agent:heartbeat',
  TASK_FILE_TASK_CREATED: 'task:file-task:created',
  TASK_FILE_TASK_STATE_CHANGED: 'task:file-task:state-changed',
  TASK_SERVER_PROVISION_PROGRESS: 'task:server:provision:progress',

  // Terminal session channels
  TERMINAL_SESSION_DATA: 'terminal-session:data',
  TERMINAL_SESSION_RESIZE: 'terminal-session:resize',
  TERMINAL_SESSION_INPUT: 'terminal-session:input',
  TERMINAL_SESSION_MC_CONSOLE: 'terminal-session:mc-console',
  TERMINAL_SESSION_NODE_LOG: 'terminal-session:node-log',
  TERMINAL_SESSION_BOT_DEBUG: 'terminal-session:bot-debug',
  TERMINAL_SESSION_BOT_DEBUG_OUTPUT: 'terminal-session:bot-debug:output',
  TERMINAL_SESSION_BOT_DEBUG_INPUT: 'terminal-session:bot-debug:input',
  TERMINAL_SESSION_BOT_CHAT: 'terminal-session:bot:chat',
  TERMINAL_SESSION_SSH_DATA: 'terminal-session:ssh:data',
  TERMINAL_SESSION_SSH_RESIZE: 'terminal-session:ssh:resize',

  // Alert channels (existing)
  ALERT_FIRED: 'alert:fired',
  ALERT_ACK: 'alert:ack',
  ALERT_SUMMARY: 'alert:summary',

  // System metrics channel
  SYSTEM_METRICS: 'resource:system:metrics',
} as const;

export type WsChannel = (typeof WsChannel)[keyof typeof WsChannel];

export interface WsMessage<T = unknown> {
  readonly protocolVersion?: number;
  readonly channel: WsChannel;
  readonly sessionId?: string;
  readonly timestamp: number;
  readonly payload: T;
}

export function createWsMessage<T>(
  channel: WsChannel,
  payload: T,
  sessionId?: string,
): WsMessage<T> {
  return {
    protocolVersion: PROTOCOL_VERSION,
    channel,
    timestamp: Date.now(),
    payload,
    ...(sessionId !== undefined ? { sessionId } : {}),
  };
}
