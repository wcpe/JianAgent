import type { ResourceKind } from '../enums/resource-kind.js';

export type HostType = 'local' | 'remote';

export interface ResourceSummaryDto {
  readonly id: string;
  readonly kind: ResourceKind;
  readonly name: string;
  readonly status: string;
  readonly statusDetail: string | null;
  readonly hostType: HostType;
  readonly host: string | null;
  readonly port: number | null;
  readonly tags: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}
