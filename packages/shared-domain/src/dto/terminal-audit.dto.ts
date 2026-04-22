export interface TerminalAuditDto {
  readonly id: string;
  readonly timestamp: string;
  readonly userId: string;
  readonly username: string;
  readonly serverId: string;
  readonly command: string;
  readonly allowed: boolean;
  readonly reason?: string;
}

export interface TerminalAuditQueryDto {
  readonly serverId?: string;
  readonly userId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly page?: number;
  readonly limit?: number;
}
