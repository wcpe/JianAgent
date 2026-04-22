export interface ScheduledStopDto {
  readonly serverId: string;
  readonly stopAt: string;
  readonly mode: 'graceful' | 'force';
}

export type ConditionType = 'no_players_for' | 'after_session' | 'memory_exceeds';

export interface ConditionalStopDto {
  readonly serverId: string;
  readonly type: ConditionType;
  readonly params: Readonly<Record<string, number>>;
}
