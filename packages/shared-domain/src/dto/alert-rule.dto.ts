import type { AlertLevel } from '../enums/alert-level.js';

export const AlertMetric = {
  TPS: 'TPS',
  MSPT: 'MSPT',
  MEMORY_USAGE: 'MEMORY_USAGE',
  BOT_DISCONNECT_RATE: 'BOT_DISCONNECT_RATE',
  PLAYER_COUNT: 'PLAYER_COUNT',
  ENTITY_COUNT: 'ENTITY_COUNT',
  LOADED_CHUNKS: 'LOADED_CHUNKS',
} as const;

export type AlertMetric = (typeof AlertMetric)[keyof typeof AlertMetric];

export const AlertOperator = {
  LESS_THAN: 'LESS_THAN',
  GREATER_THAN: 'GREATER_THAN',
  EQUALS: 'EQUALS',
} as const;

export type AlertOperator = (typeof AlertOperator)[keyof typeof AlertOperator];

export interface AlertRuleDto {
  readonly id: string;
  readonly name: string;
  readonly metric: AlertMetric;
  readonly operator: AlertOperator;
  readonly threshold: number;
  readonly level: AlertLevel;
  readonly enabled: boolean;
  readonly cooldownSeconds: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateAlertRuleDto {
  readonly name: string;
  readonly metric: AlertMetric;
  readonly operator: AlertOperator;
  readonly threshold: number;
  readonly level: AlertLevel;
  readonly cooldownSeconds?: number;
}

export interface UpdateAlertRuleDto {
  readonly name?: string;
  readonly threshold?: number;
  readonly level?: AlertLevel;
  readonly enabled?: boolean;
  readonly cooldownSeconds?: number;
}
