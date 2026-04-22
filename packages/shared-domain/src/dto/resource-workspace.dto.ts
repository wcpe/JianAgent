import type { ResourceSummaryDto } from './resource-summary.dto.js';
import type { ResourceStatusSummaryDto } from './resource-status-summary.dto.js';
import type { ResourceCapabilityDto } from './resource-capability.dto.js';
import type { ResourceActionDto } from './resource-action.dto.js';
import type { ResourceValidationSummaryDto } from './resource-validation-summary.dto.js';
import type { ServerType } from './server-config.dto.js';

export interface ResourceWorkspaceItemDto {
  readonly summary: ResourceSummaryDto;
  readonly serverType: ServerType | null;
  readonly group: string | null;
  readonly description: string | null;
  readonly status: ResourceStatusSummaryDto;
  readonly capabilities: ResourceCapabilityDto;
  readonly availableActions: readonly ResourceActionDto[];
  readonly latestValidationSummary: ResourceValidationSummaryDto | null;
}

export interface ResourceWorkspaceSummaryDto {
  readonly total: number;
  readonly byKind: Readonly<Record<string, number>>;
  readonly byStatus: Readonly<Record<string, number>>;
  readonly byServerType: Readonly<Record<string, number>>;
}

export interface ResourceWorkspaceListDto {
  readonly items: readonly ResourceWorkspaceItemDto[];
  readonly summary: ResourceWorkspaceSummaryDto;
  readonly page: number;
  readonly limit: number;
  readonly total: number;
}
