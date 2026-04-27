export interface ThreadStateDistributionDto {
  RUNNABLE: number;
  WAITING: number;
  TIMED_WAITING: number;
  BLOCKED: number;
  NEW: number;
  TERMINATED: number;
}

export interface DeadlockInfoDto {
  threadId: number;
  threadName: string;
  lockName: string;
  lockOwnerId: number;
  lockOwnerName: string;
}

export interface ThreadCpuInfoDto {
  threadId: number;
  threadName: string;
  cpuTimeMs: number;
  userTimeMs: number;
  state: string;
}

export interface ThreadSnapshotDto {
  type: 'thread-snapshot';
  timestamp: number;
  totalThreads: number;
  daemonThreads: number;
  peakThreads: number;
  stateDistribution: ThreadStateDistributionDto;
  deadlockedThreads: DeadlockInfoDto[];
  topCpuThreads: ThreadCpuInfoDto[];
}
