export class CreateBotGroupDto {
  readonly serverId!: string;
  readonly count!: number;
  readonly namePrefix!: string;
  readonly behavior?: string;
  readonly behaviorParams?: Record<string, unknown>;
  readonly autoRespawn?: boolean;
}
