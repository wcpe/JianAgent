import type { LogEntryDto } from '@jian-agent/shared-domain';
import { createWsMessage } from './ws-message.js';

export const LogChannel = {
  LOG_ENTRY: 'resource:log:entry',
  LOG_STREAM: 'resource:log:stream',
} as const;

export type LogChannel = (typeof LogChannel)[keyof typeof LogChannel];

export interface LogEntryPayload {
  readonly entry: LogEntryDto;
}

export interface LogStreamSubscribePayload {
  readonly serverId?: string;
  readonly source?: string;
  readonly level?: string;
}

export function createLogEntryMessage(entry: LogEntryDto) {
  return createWsMessage(LogChannel.LOG_ENTRY as any, { entry });
}
