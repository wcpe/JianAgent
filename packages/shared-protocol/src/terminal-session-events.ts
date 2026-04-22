/**
 * Terminal session events - terminal data, resize, input, debug, SSH terminal
 */

import type { ResourceRefDto, TerminalSessionState } from '@jian-agent/shared-domain';

// Terminal data events
export interface TerminalDataPayload {
  readonly sessionId: string;
  readonly resourceRef: ResourceRefDto;
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

// Special terminal events
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

export interface TerminalBotDebugPayload {
  readonly sessionId: string;
  readonly resourceRef: ResourceRefDto;
  readonly sessionState: TerminalSessionState;
  readonly botName: string;
  readonly data: string;
}

// Bot debug events
export interface BotDebugOutputPayload {
  readonly resourceRef: ResourceRefDto;
  readonly botName: string;
  readonly data: string;
  readonly timestamp: number;
}

export interface BotDebugInputPayload {
  readonly resourceRef: ResourceRefDto;
  readonly botName: string;
  readonly command: string;
}

// Bot chat events
export interface BotChatPayload {
  readonly resourceRef: ResourceRefDto;
  readonly botName: string;
  readonly message: string;
  readonly timestamp: number;
}

// SSH terminal events
export interface SshTerminalDataPayload {
  readonly resourceRef: ResourceRefDto;
  readonly serverId: string;
  readonly data: string;
}

export interface SshTerminalResizePayload {
  readonly resourceRef: ResourceRefDto;
  readonly serverId: string;
  readonly cols: number;
  readonly rows: number;
}
