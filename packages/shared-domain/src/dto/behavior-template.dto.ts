export interface BehaviorStepDto {
  readonly behavior: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly durationMs: number;
}

export interface BehaviorTemplateDto {
  readonly id: string;
  readonly name: string;
  readonly navigationProfile?: string;
  readonly scenarioProfile?: string;
  readonly determinismLevel?: 'strict' | 'balanced' | 'organic';
  readonly steps: readonly BehaviorStepDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateBehaviorTemplateDto {
  readonly name: string;
  readonly navigationProfile?: string;
  readonly scenarioProfile?: string;
  readonly determinismLevel?: 'strict' | 'balanced' | 'organic';
  readonly steps: readonly BehaviorStepDto[];
}

export interface UpdateBehaviorTemplateDto {
  readonly name?: string;
  readonly navigationProfile?: string;
  readonly scenarioProfile?: string;
  readonly determinismLevel?: 'strict' | 'balanced' | 'organic';
  readonly steps?: readonly BehaviorStepDto[];
}
