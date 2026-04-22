export { PROTOCOL_VERSION } from './version.js';
export { WsChannel, createWsMessage } from './ws-message.js';
export type { WsMessage } from './ws-message.js';

// Resource events
export type {
  ServerStatusPayload,
  ServerOutputPayload,
  ServerCrashedPayload,
  ServerHealthPayload,
  BotSummaryPayload,
  BotStatePayload,
  SessionStatePayload,
  PluginStatusPayload,
  PluginSnapshotPayload,
  JavaHelperStatusPayload,
  WorkerStatusPayload,
  LogTailPayload,
  LogTailStartPayload,
  LogTailStopPayload,
} from './resource-events.js';

// Task events
export type {
  BotEventPayload,
  SessionStatusPayload,
  SessionPhasePayload,
  PhaseStatusPayload,
  ControlPlaneAgentRegisteredPayload,
  ControlPlaneAgentHeartbeatPayload,
} from './task-events.js';

// Terminal session events
export type {
  TerminalDataPayload,
  TerminalResizePayload,
  TerminalInputPayload,
  TerminalMcConsolePayload,
  TerminalNodeLogPayload,
  TerminalBotDebugPayload,
  BotDebugOutputPayload,
  BotDebugInputPayload,
  BotChatPayload,
  SshTerminalDataPayload,
  SshTerminalResizePayload,
} from './terminal-session-events.js';

// Terminal event factories (from terminal-events.ts)
export {
  createTerminalDataMessage,
  createTerminalInputMessage,
  createTerminalResizeMessage,
  createMcConsoleMessage,
  createNodeLogMessage,
} from './terminal-events.js';
export type {
  TerminalDataPayload as TerminalDataPayloadV2,
  TerminalResizePayload as TerminalResizePayloadV2,
  TerminalInputPayload as TerminalInputPayloadV2,
  TerminalMcConsolePayload as TerminalMcConsolePayloadV2,
  TerminalNodeLogPayload as TerminalNodeLogPayloadV2,
} from './terminal-events.js';

// Alert events (existing)
export type { AlertPayload } from './alert-events.js';
export { AlertChannel, createAlertFiredMessage, createAlertAckMessage, createAlertSummaryMessage } from './alert-events.js';
export type { AlertFiredPayload, AlertAckPayload, AlertSummaryPayload } from './alert-events.js';

// Bot events (existing)
export { BotEventType } from './bot-events.js';
export type { BotStatePush, BotEventPush, BotDebugOutput, BotDebugInput } from './bot-events.js';

// Session events (existing)
export type { SessionStatePush, SessionPhasePush } from './session-events.js';

// IPC events (existing)
export { IpcCommand, IpcEvent } from './ipc-events.js';
export type {
  IpcMessage,
  CreateBotsPayload,
  PingPayload,
  PongPayload,
  SetPhasePayload,
  SetBehaviorPayload,
  DebugStartPayload,
  DebugCommandPayload,
  StateReportPayload,
  EventReportPayload,
  ExecuteScriptPayload,
  ScriptProgressPayload,
  GetBotDetailPayload,
  BotDetailResponsePayload,
  ChatMessagePayload,
  ForceRespawnPayload,
} from './ipc-events.js';

// plugin bridge (existing)
export {
  PLUGIN_PROTOCOL_VERSION,
  PluginBridgeChannel,
  createBridgeMessage,
} from './plugin-events.js';
export type {
  BridgeMessage,
  HandshakeRequestPayload,
  HandshakeResponsePayload,
  SnapshotPushPayload,
  EventPushPayload,
  CommandRequestPayload,
  CommandResponsePayload,
} from './plugin-events.js';

// Log events (existing)
export { LogChannel, createLogEntryMessage } from './log-events.js';
export type { LogEntryPayload, LogStreamSubscribePayload } from './log-events.js';

// Bot script (existing)
export { SCRIPT_PRESETS } from './bot-script.js';
export type { BotScript, BotScriptStep, BotScriptAction } from './bot-script.js';

// File task events
export type {
  FileTaskProgressPayload,
  FileTaskCompletedPayload,
  FileTaskFailedPayload,
} from './file-task-events.js';

// Worker events (existing)
export { WorkerChannel } from './worker-events.js';
export type { WorkerEventPayload, MetricSummaryPayload } from './worker-events.js';

// JVM control-plane (existing)
export { CONTROL_PLANE_EVENTS } from './control-plane-events.js';
export type { ControlPlaneEventName } from './control-plane-events.js';
