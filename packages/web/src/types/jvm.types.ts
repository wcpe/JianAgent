export interface JvmProcess {
  pid: number;
  name: string;
  mainClass: string;
  javaVersion: string;
  jvmVersion: string;
  startTime: string;
  uptime: number;
  user: string;
  commandLine: string;
}

export interface JvmMemory {
  heapUsed: number;
  heapMax: number;
  heapCommitted: number;
  nonHeapUsed: number;
  nonHeapMax: number;
  nonHeapCommitted: number;
}

export interface JvmThread {
  threadCount: number;
  peakThreadCount: number;
  daemonThreadCount: number;
  totalStartedThreadCount: number;
}

export interface JvmGc {
  youngGcCount: number;
  youngGcTime: number;
  oldGcCount: number;
  oldGcTime: number;
}

export interface JvmProcessDetail extends JvmProcess {
  memory?: JvmMemory;
  thread?: JvmThread;
  gc?: JvmGc;
  cpuUsage?: number;
}

export interface JvmListResponse {
  data: JvmProcessDetail[];
  total: number;
}

export interface JvmQueryParams {
  page?: number;
  pageSize?: number;
  name?: string;
  mainClass?: string;
  user?: string;
}
