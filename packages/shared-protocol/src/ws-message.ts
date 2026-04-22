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

  // Legacy aliases (deprecated - use new unified channels)
  /** @deprecated Use RESOURCE_SERVER_STATUS instead */
  SERVER_STATUS: 'server:status',
  /** @deprecated Use RESOURCE_SERVER_OUTPUT instead */
  SERVER_OUTPUT: 'server:output',
  /** @deprecated Use RESOURCE_SERVER_CRASHED instead */
  SERVER_CRASHED: 'server:crashed',
  /** @deprecated Use RESOURCE_SERVER_HEALTH instead */
  SERVER_HEALTH: 'server:health',
  /** @deprecated Use TERMINAL_SESSION_DATA instead */
  TERMINAL_DATA: 'terminal:data',
  /** @deprecated Use TERMINAL_SESSION_RESIZE instead */
  TERMINAL_RESIZE: 'terminal:resize',
  /** @deprecated Use TERMINAL_SESSION_INPUT instead */
  TERMINAL_INPUT: 'terminal:input',
  /** @deprecated Use TERMINAL_SESSION_MC_CONSOLE instead */
  TERMINAL_MC_CONSOLE: 'terminal:mc-console',
  /** @deprecated Use TERMINAL_SESSION_NODE_LOG instead */
  TERMINAL_NODE_LOG: 'terminal:node-log',
  /** @deprecated Use TERMINAL_SESSION_BOT_DEBUG instead */
  TERMINAL_BOT_DEBUG: 'terminal:bot-debug',
  /** @deprecated Use RESOURCE_BOT_SUMMARY instead */
  BOT_SUMMARY: 'bot:summary',
  /** @deprecated Use TASK_BOT_EVENT instead */
  BOT_EVENT: 'bot:event',
  /** @deprecated Use RESOURCE_BOT_STATE instead */
  BOT_STATE: 'bot:state',
  /** @deprecated Use TERMINAL_SESSION_BOT_DEBUG_OUTPUT instead */
  BOT_DEBUG: 'bot:debug',
  /** @deprecated Use TERMINAL_SESSION_BOT_CHAT instead */
  BOT_CHAT: 'bot:chat',
  /** @deprecated Use TASK_SESSION_STATUS instead */
  SESSION_STATUS: 'session:status',
  /** @deprecated Use RESOURCE_SESSION_STATE instead */
  SESSION_STATE: 'session:state',
  /** @deprecated Use TASK_SESSION_PHASE instead */
  SESSION_PHASE: 'session:phase',
  /** @deprecated Use TASK_PHASE_STATUS instead */
  PHASE_STATUS: 'phase:status',
  /** @deprecated Use ALERT_FIRED instead */
  ALERT: 'alert',
  /** @deprecated Use RESOURCE_PLUGIN_STATUS instead */
  PLUGIN_STATUS: 'plugin:status',
  /** @deprecated Use RESOURCE_PLUGIN_SNAPSHOT instead */
  PLUGIN_SNAPSHOT: 'plugin:snapshot',
  /** @deprecated Use RESOURCE_JAVA_HELPER_STATUS instead */
  JAVA_HELPER_STATUS: 'java-helper:status',
  /** @deprecated Use TASK_WORKER_EVENT instead */
  WORKER_EVENT: 'worker:event',
  /** @deprecated Use RESOURCE_WORKER_STATUS instead */
  WORKER_STATUS: 'worker:status',
  /** @deprecated Use RESOURCE_METRIC_SUMMARY instead */
  METRIC_SUMMARY: 'metric:summary',
  /** @deprecated Use TASK_CONTROL_PLANE_AGENT_REGISTERED instead */
  CONTROL_PLANE_AGENT_REGISTERED: 'control-plane:agent:registered',
  /** @deprecated Use TASK_CONTROL_PLANE_AGENT_HEARTBEAT instead */
  CONTROL_PLANE_AGENT_HEARTBEAT: 'control-plane:agent:heartbeat',
  /** @deprecated Use TERMINAL_SESSION_SSH_DATA instead */
  SSH_TERMINAL_DATA: 'ssh:terminal:data',
  /** @deprecated Use TERMINAL_SESSION_SSH_RESIZE instead */
  SSH_TERMINAL_RESIZE: 'ssh:terminal:resize',
  /** @deprecated Use RESOURCE_LOG_TAIL instead */
  LOG_TAIL: 'log:tail',
  /** @deprecated Use RESOURCE_LOG_TAIL_START instead */
  LOG_TAIL_START: 'log:tail:start',
  /** @deprecated Use RESOURCE_LOG_TAIL_STOP instead */
  LOG_TAIL_STOP: 'log:tail:stop',
} as const;

export type WsChannel = (typeof WsChannel)[keyof typeof WsChannel];

export interface WsMessage<T = unknown> {
  readonly protocolVersion: number;
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
