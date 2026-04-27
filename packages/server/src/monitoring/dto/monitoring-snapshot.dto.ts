import type { MemorySnapshotDto } from './memory-snapshot.dto.js';
import type { ThreadSnapshotDto } from './thread-snapshot.dto.js';
import type { GcSnapshotDto } from './gc-snapshot.dto.js';

export interface MonitoringSnapshotDto {
  type: 'monitoring-snapshot';
  timestamp: number;
  memory: MemorySnapshotDto['heap'] & { nonHeap: MemorySnapshotDto['nonHeap'] };
  threads: Omit<ThreadSnapshotDto, 'type' | 'timestamp'>;
  gc: Omit<GcSnapshotDto, 'type' | 'timestamp'>;
}

export type MonitoringEventDto = MemorySnapshotDto | ThreadSnapshotDto | GcSnapshotDto | MonitoringSnapshotDto;
