export interface WhitelistActionRequest {
  readonly action: string;
  readonly params: Readonly<Record<string, unknown>>;
}

export interface WhitelistActionResult {
  readonly action: string;
  readonly success: boolean;
  readonly message: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly timestamp: string;
}

export interface WhitelistActionDefinition {
  readonly name: string;
  readonly label: string;
  readonly fields: readonly WhitelistActionField[];
}

export interface WhitelistActionField {
  readonly key: string;
  readonly label: string;
  readonly type: 'string' | 'number' | 'boolean';
  readonly required?: boolean;
  readonly defaultValue?: string | number | boolean;
}

export interface PlayerDeathEventDto {
  readonly player: string;
  readonly killer: string;
  readonly cause: string;
  readonly location: Readonly<{ x: number; y: number; z: number; world: string }>;
  readonly sessionId?: string;
}

export interface PlayerTeleportEventDto {
  readonly player: string;
  readonly from: Readonly<{ x: number; y: number; z: number; world: string }>;
  readonly to: Readonly<{ x: number; y: number; z: number; world: string }>;
  readonly cause: string;
  readonly sessionId?: string;
}

export interface PlayerKickEventDto {
  readonly player: string;
  readonly reason: string;
  readonly sessionId?: string;
}
