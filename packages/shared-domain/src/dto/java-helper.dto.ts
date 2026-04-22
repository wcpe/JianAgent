import type { JavaHelperState } from '../enums/java-helper-state.js';
import type { JvmCapabilityDescriptorDto } from './jvm-capability.dto.js';

export interface JavaHelperStatusDto {
  readonly state: JavaHelperState;
  readonly attachedPid?: string;
  readonly processName?: string;
  readonly lastError?: string;
  readonly lastSampleTime?: string;
  /** Declared JVM capabilities for this helper instance. */
  readonly capabilities?: JvmCapabilityDescriptorDto;
}

export interface ThreadInfoDto {
  readonly id: number;
  readonly name: string;
  readonly state: string;
  readonly stackTrace: readonly string[];
}

export interface ThreadSampleDto {
  readonly threadCount: number;
  readonly threads: readonly ThreadInfoDto[];
  readonly sampledAt: string;
}

export interface HeapUsageDto {
  readonly used: number;
  readonly max: number;
  readonly committed: number;
  readonly usagePercent: number;
}

export interface HeapSampleDto {
  readonly heapUsage: HeapUsageDto;
  readonly nonHeapUsage: HeapUsageDto;
  readonly sampledAt: string;
}

export type JfrTaskStatus = 'running' | 'completed' | 'failed';

export interface JfrTaskDto {
  readonly id: string;
  readonly serverId: string;
  readonly pid: string;
  readonly recordingName: string;
  readonly status: JfrTaskStatus;
  readonly filePath: string;
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly error?: string;
}
