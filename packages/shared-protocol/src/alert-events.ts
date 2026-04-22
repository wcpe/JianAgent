import type { AlertLevel, AlertDto, AlertSummaryDto } from '@jian-agent/shared-domain';
import { createWsMessage } from './ws-message.js';

export interface AlertPayload {
  readonly id: string;
  readonly level: AlertLevel;
  readonly source: string;
  readonly message: string;
  readonly timestamp: string;
  readonly details?: string;
}

export const AlertChannel = {
  ALERT_FIRED: 'alert:fired',
  ALERT_ACK: 'alert:ack',
  ALERT_SUMMARY: 'alert:summary',
} as const;

export type AlertChannel = (typeof AlertChannel)[keyof typeof AlertChannel];

export interface AlertFiredPayload {
  readonly alert: AlertDto;
}

export interface AlertAckPayload {
  readonly alertId: string;
}

export interface AlertSummaryPayload {
  readonly summary: AlertSummaryDto;
}

export function createAlertFiredMessage(alert: AlertDto) {
  return createWsMessage(AlertChannel.ALERT_FIRED as any, { alert });
}

export function createAlertAckMessage(alertId: string) {
  return createWsMessage(AlertChannel.ALERT_ACK as any, { alertId });
}

export function createAlertSummaryMessage(summary: AlertSummaryDto) {
  return createWsMessage(AlertChannel.ALERT_SUMMARY as any, { summary });
}
