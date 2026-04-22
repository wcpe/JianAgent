export interface AuditRecord {
  readonly id: string;
  readonly timestamp: string;
  readonly userId: string;
  readonly username: string;
  readonly operation: string;
  readonly target: string;
  readonly params: string;
  readonly success: boolean;
  readonly ip: string;
}

export interface AuditQueryParams {
  readonly userId?: string;
  readonly operation?: string;
  readonly startTime?: string;
  readonly endTime?: string;
  readonly page?: number;
  readonly limit?: number;
}

export interface PaginatedResponse<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}
