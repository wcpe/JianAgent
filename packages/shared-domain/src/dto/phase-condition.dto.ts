export type ConditionType =
  | 'time_elapsed'
  | 'all_bots_ready'
  | 'bot_count_below'
  | 'tps_below'
  | 'custom_event';

export type Combinator = 'AND' | 'OR';

export interface PhaseConditionDto {
  readonly type: ConditionType;
  readonly params: Readonly<Record<string, number | string>>;
}

export interface PhaseExitConfigDto {
  readonly conditions: readonly PhaseConditionDto[];
  readonly combinator: Combinator;
}

export type FailureAction = 'abort' | 'retry' | 'rollback_to';

export interface PhaseFailureConfigDto {
  readonly failureAction: FailureAction;
  readonly rollbackTarget?: number;
  readonly maxRetries?: number;
}
