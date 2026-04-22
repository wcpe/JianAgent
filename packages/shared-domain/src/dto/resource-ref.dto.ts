import type { ResourceKind } from '../enums/resource-kind.js';

export interface ResourceRefDto {
  readonly id: string;
  readonly kind: ResourceKind;
  readonly name: string;
}
