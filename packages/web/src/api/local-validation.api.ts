import { apiFetch } from './client.js';
import type {
  LocalValidationAssertionDto,
  LocalValidationEvidenceDto,
  LocalValidationRunDto,
  LocalValidationScenarioPackDto,
  LocalValidationStageDto,
} from '@jian-agent/shared-domain';

export type {
  LocalValidationAssertionDto,
  LocalValidationEvidenceDto,
  LocalValidationRunDto,
  LocalValidationScenarioPackDto,
  LocalValidationStageDto,
} from '@jian-agent/shared-domain';

export interface CreateLocalValidationRunRequest {
  readonly name: string;
  readonly mode: LocalValidationRunDto['mode'];
  readonly paperVersion?: string;
  readonly scenarioPackId: string;
  readonly requestedBotCount: number;
  readonly keepServerRunning: boolean;
  readonly keepWorkspace: boolean;
}

export const localValidationApi = {
  listScenarioPacks: () =>
    apiFetch<LocalValidationScenarioPackDto[]>('/local-validation/scenario-packs'),

  listRuns: () =>
    apiFetch<LocalValidationRunDto[]>('/local-validation/runs'),

  getRun: (id: string) =>
    apiFetch<LocalValidationRunDto>(`/local-validation/runs/${encodeURIComponent(id)}`),

  createRun: (dto: CreateLocalValidationRunRequest) =>
    apiFetch<LocalValidationRunDto>('/local-validation/runs', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  startRun: (id: string) =>
    apiFetch<LocalValidationRunDto>(`/local-validation/runs/${encodeURIComponent(id)}/start`, {
      method: 'POST',
    }),

  cancelRun: (id: string) =>
    apiFetch<LocalValidationRunDto>(`/local-validation/runs/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    }),

  loadRunStages: (runId: string) =>
    apiFetch<LocalValidationStageDto[]>(`/local-validation/runs/${encodeURIComponent(runId)}/stages`),

  loadRunAssertions: (runId: string) =>
    apiFetch<LocalValidationAssertionDto[]>(`/local-validation/runs/${encodeURIComponent(runId)}/assertions`),

  loadRunEvidence: (runId: string) =>
    apiFetch<LocalValidationEvidenceDto[]>(`/local-validation/runs/${encodeURIComponent(runId)}/evidence`),
} as const;
