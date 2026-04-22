export class CreateSessionDto {
  readonly name!: string;
  readonly serverId!: string;
  readonly botConfigId!: string;
  readonly phases!: ReadonlyArray<{
    readonly phase: string;
    readonly botCount: number;
    readonly behavior: string;
    readonly durationSec: number;
  }>;
}
