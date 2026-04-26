export interface PortUsage {
  port: number;
  protocol: string;
  processName: string;
  pid: number;
  status: string;
  hostId: string;
  hostname: string;
  timestamp: string;
}

export interface PortUsageResponse {
  data: PortUsage[];
  total: number;
}

export interface PortQueryParams {
  page?: number;
  pageSize?: number;
  port?: number;
  protocol?: string;
  processName?: string;
  hostId?: string;
}
