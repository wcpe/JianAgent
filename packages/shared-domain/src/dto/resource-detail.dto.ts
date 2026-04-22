import type { ResourceKind } from '../enums/resource-kind.js';
import type { HostType } from './resource-summary.dto.js';
import type { ResourceStatusSummaryDto } from './resource-status-summary.dto.js';
import type { ResourceCapabilityDto } from './resource-capability.dto.js';
import type { ResourceRefDto } from './resource-ref.dto.js';
import type { ServerType } from './server-config.dto.js';
import type { ResourceActionDto } from './resource-action.dto.js';
import type { ResourceValidationSummaryDto } from './resource-validation-summary.dto.js';

/**
 * Unified resource detail — the canonical shape returned by
 * GET /resources/:id.  Both ManagedServer and RemoteHost (and
 * any future resource kind) map to this single structure so the
 * frontend only needs one detail component.
 */
export interface ResourceDetailDto {
  // ── Identity ──────────────────────────────────────────────
  readonly id: string;
  readonly kind: ResourceKind;
  readonly name: string;
  readonly serverType: ServerType | null;
  readonly hostType: HostType;
  readonly host: string | null;
  readonly port: number | null;
  readonly tags: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;

  // ── Status ────────────────────────────────────────────────
  readonly status: ResourceStatusSummaryDto;

  // ── Capabilities ──────────────────────────────────────────
  readonly capabilities: ResourceCapabilityDto;
  readonly availableActions: readonly ResourceActionDto[];
  readonly latestValidationSummary: ResourceValidationSummaryDto | null;

  // ── Related resources ─────────────────────────────────────
  /** Resources that this resource depends on. */
  readonly dependencies: readonly ResourceRefDto[];
  /** Resources that depend on this resource. */
  readonly dependents: readonly ResourceRefDto[];
}
