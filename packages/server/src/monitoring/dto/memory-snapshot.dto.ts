export interface MemoryPoolDto {
  used: number;
  max: number;
  committed: number;
  usagePercent: number;
}

export interface HeapMemoryDto {
  used: number;
  max: number;
  committed: number;
  usagePercent: number;
  pools: {
    eden?: MemoryPoolDto;
    survivor?: MemoryPoolDto;
    oldGen?: MemoryPoolDto;
  };
}

export interface NonHeapMemoryDto {
  used: number;
  max: number;
  committed: number;
  usagePercent: number;
  pools: {
    metaspace?: MemoryPoolDto;
    codeCache?: MemoryPoolDto;
    compressedClassSpace?: MemoryPoolDto;
  };
}

export interface MemorySnapshotDto {
  type: 'memory-snapshot';
  timestamp: number;
  heap: HeapMemoryDto;
  nonHeap: NonHeapMemoryDto;
}
