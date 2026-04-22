import { createWsMessage, WsChannel } from './ws-message.js';
import type { ResourceRefDto, TerminalSessionState } from '@jian-agent/shared-domain';

// --- Payload types (unified base DTOs) ---

export interface TerminalDataPayload {
  /** Session identifier for routing terminal data */
  readonly sessionId: string;
  /** Unified resource reference for the terminal's parent resource */
  readonly resourceRef: ResourceRefDto;
  /** Current session lifecycle state */
  readonly sessionState: TerminalSessionState;
  readonly data: string;
}

export interface TerminalResizePayload {
  readonly sessionId: string;
  readonly resourceRef: ResourceRefDto;
  readonly sessionState: TerminalSessionState;
  readonly cols: number;
  readonly rows: number;
}

export interface TerminalInputPayload {
  readonly sessionId: string;
  readonly resourceRef: ResourceRefDto;
  readonly sessionState: TerminalSessionState;
  readonly data: string;
}

export interface TerminalMcConsolePayload {
  readonly sessionId: string;
  readonly resourceRef: ResourceRefDto;
  readonly sessionState: TerminalSessionState;
  readonly data: string;
}

export interface TerminalNodeLogPayload {
  readonly sessionId: string;
  readonly resourceRef: ResourceRefDto;
  readonly sessionState: TerminalSessionState;
  readonly data: string;
}

// --- Factory functions ---

export function createTerminalDataMessage(
  data: string,
  sessionId: string,
  resourceRef: ResourceRefDto,
  sessionState: TerminalSessionState = 'ACTIVE',
) {
  return createWsMessage(
    WsChannel.TERMINAL_SESSION_DATA,
    { sessionId, resourceRef, sessionState, data } satisfies TerminalDataPayload,
    sessionId,
  );
}

export function createTerminalInputMessage(
  data: string,
  sessionId: string,
  resourceRef: ResourceRefDto,
  sessionState: TerminalSessionState = 'ACTIVE',
) {
  return createWsMessage(
    WsChannel.TERMINAL_SESSION_INPUT,
    { sessionId, resourceRef, sessionState, data } satisfies TerminalInputPayload,
    sessionId,
  );
}

export function createTerminalResizeMessage(
  cols: number,
  rows: number,
  sessionId: string,
  resourceRef: ResourceRefDto,
  sessionState: TerminalSessionState = 'ACTIVE',
) {
  return createWsMessage(
    WsChannel.TERMINAL_SESSION_RESIZE,
    { sessionId, resourceRef, sessionState, cols, rows } satisfies TerminalResizePayload,
    sessionId,
  );
}

export function createMcConsoleMessage(
  data: string,
  sessionId: string,
  resourceRef: ResourceRefDto,
  sessionState: TerminalSessionState = 'ACTIVE',
) {
  return createWsMessage(
    WsChannel.TERMINAL_SESSION_MC_CONSOLE,
    { sessionId, resourceRef, sessionState, data } satisfies TerminalMcConsolePayload,
    sessionId,
  );
}

export function createNodeLogMessage(
  data: string,
  sessionId: string,
  resourceRef: ResourceRefDto,
  sessionState: TerminalSessionState = 'ACTIVE',
) {
  return createWsMessage(
    WsChannel.TERMINAL_SESSION_NODE_LOG,
    { sessionId, resourceRef, sessionState, data } satisfies TerminalNodeLogPayload,
    sessionId,
  );
}
