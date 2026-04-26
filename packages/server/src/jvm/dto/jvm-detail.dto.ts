export interface ThreadSampleDto {
  threadName: string;
  state: string;
  stackTrace: string[];
}

export interface HeapSampleDto {
  className: string;
  instances: number;
  bytes: number;
}

export interface JvmStatusDto {
  state: string;
  attachedPid?: string;
}

export interface JvmDetailResponseDto {
  success: boolean;
  data?: unknown;
  error?: string;
}
