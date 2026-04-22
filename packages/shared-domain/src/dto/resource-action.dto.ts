export type ResourceActionKind = 'primary' | 'secondary' | 'danger' | 'navigation';

export interface ResourceActionDto {
  readonly key: string;
  readonly label: string;
  readonly kind: ResourceActionKind;
  readonly enabled: boolean;
  readonly reason?: string | null;
}
