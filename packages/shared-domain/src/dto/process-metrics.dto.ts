export interface ProcessMetrics {
  readonly serverId: string;
  readonly timestamp: string;
  readonly cpuPercent: number;
  readonly rssBytes: number;
  readonly heapUsed?: number;
  readonly heapMax?: number;
  readonly threadCount?: number;
  readonly fdCount?: number;
}

export interface ProcessMetricsSummary {
  readonly serverId: string;
  readonly current: ProcessMetrics | null;
  readonly peak: {
    readonly cpuPercent: number;
    readonly rssBytes: number;
  };
  readonly average: {
    readonly cpuPercent: number;
    readonly rssBytes: number;
  };
}
