export class SetBehaviorDto {
  readonly botName!: string;
  readonly behavior!: string;
  readonly params?: Record<string, unknown>;
}
