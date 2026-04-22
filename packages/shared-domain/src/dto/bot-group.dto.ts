export interface BotGroupDto {
  readonly id: string;
  readonly sessionId: string;
  readonly name: string;
  readonly botNames: readonly string[];
  readonly createdAt: string;
}

export interface CreateBotGroupRequestDto {
  readonly sessionId: string;
  readonly name: string;
  readonly botNames: readonly string[];
}

export interface ModifyBotGroupRequestDto {
  readonly botNames: readonly string[];
}

export interface ApplyBehaviorToGroupDto {
  readonly templateId: string;
}
