/** Validation plan DTO — defines a reusable validation workflow */

export interface ValidationPlanDto {
  readonly id: string;
  readonly name: string;
  readonly targetType: 'server' | 'bot-group' | 'session' | 'plugin';
  readonly targetId: string;
  readonly phases: readonly ValidationPhaseDto[];
  readonly successThreshold: number; // 0–100 percentage
  readonly triggerType: 'manual' | 'scheduled' | 'event-based';
  readonly governanceActionIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ValidationPhaseDto {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly durationMs: number;
  readonly criteria: readonly ValidationCriterionDto[];
}

export interface ValidationCriterionDto {
  readonly metric: string;
  readonly operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  readonly threshold: number;
  readonly weight: number; // 0–1, sum of all criteria weights in a phase = 1
}