import type { BotSummary, BotInventoryItem, BotNearbyEntity, BotTerrainBlock, PhaseType } from '@jian-agent/shared-domain';
import type { BotEventPush } from './bot-events.js';
import type { BotScript } from './bot-script.js';

export const IpcCommand = {
  PING: 'ping',
  CREATE_BOTS: 'create-bots',
  DESTROY_BOTS: 'destroy-bots',
  RECONNECT_BOTS: 'reconnect-bots',
  SET_PHASE: 'set-phase',
  SET_BEHAVIOR: 'set-behavior',
  STOP_BOTS: 'stop-bots',
  DEBUG_START: 'debug-start',
  DEBUG_COMMAND: 'debug-command',
  DEBUG_STOP: 'debug-stop',
  GET_BOT_DETAIL: 'get-bot-detail',
  EXECUTE_SCRIPT: 'execute-script',
  STOP_SCRIPT: 'stop-script',
  FORCE_RESPAWN: 'force-respawn',
  SHUTDOWN: 'shutdown',
} as const;
export type IpcCommand = (typeof IpcCommand)[keyof typeof IpcCommand];

export const IpcEvent = {
  PONG: 'pong',
  STATE_REPORT: 'report-state',
  EVENT_REPORT: 'report-event',
  DEBUG_OUTPUT: 'debug-output',
  WORKER_READY: 'worker-ready',
  WORKER_ERROR: 'worker-error',
  SCRIPT_PROGRESS: 'script-progress',
  BOT_DETAIL_RESPONSE: 'bot-detail-response',
  CHAT_MESSAGE: 'chat-message',
} as const;
export type IpcEvent = (typeof IpcEvent)[keyof typeof IpcEvent];

export interface IpcMessage<T = unknown> {
  readonly type: IpcCommand | IpcEvent;
  readonly requestId?: string;
  readonly payload: T;
}

export interface CreateBotsPayload {
  readonly serverHost: string;
  readonly serverPort: number;
  readonly serverVersion?: string;
  readonly names: readonly string[];
  readonly connectTimeoutMs: number;
  readonly reconnectEnabled: boolean;
  readonly reconnectMaxRetries: number;
  readonly behaviorTemplate: string;
  readonly autoRespawn: boolean;
}

export interface PingPayload {
  readonly timestamp: number;
}

export interface PongPayload {
  readonly pid: number;
  readonly timestamp: number;
  readonly botCount: number;
}

export interface SetPhasePayload {
  readonly phaseType: PhaseType;
  readonly behaviorTemplate?: string;
}

export interface SetBehaviorPayload {
  readonly botName?: string;
  readonly behaviorName: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

export interface DebugStartPayload {
  readonly botName: string;
}

export interface DebugCommandPayload {
  readonly botName: string;
  readonly command: string;
}

export interface StateReportPayload {
  readonly bots: readonly BotSummary[];
}

export interface EventReportPayload {
  readonly events: readonly BotEventPush[];
}

export interface ExecuteScriptPayload {
  readonly botName: string;
  readonly script: BotScript;
}

export interface ScriptProgressPayload {
  readonly botName: string;
  readonly stepIndex: number;
  readonly totalSteps: number;
  readonly loopIteration: number;
  readonly completed: boolean;
}

export interface ForceRespawnPayload {
  readonly botName: string;
}

export interface GetBotDetailPayload {
  readonly botName: string;
}

export interface BotDetailResponsePayload {
  readonly botName: string;
  readonly requestId: string;
  readonly inventory: readonly BotInventoryItem[];
  readonly nearbyEntities: readonly BotNearbyEntity[];
  readonly terrain: readonly BotTerrainBlock[];
}

export interface ChatMessagePayload {
  readonly botName: string;
  readonly message: string;
  readonly timestamp: number;
}
