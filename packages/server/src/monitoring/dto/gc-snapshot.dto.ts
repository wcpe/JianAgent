export interface GcCollectorDto {
  name: string;
  collectionCount: number;
  collectionTimeMs: number;
  memoryPools: string[];
}

export interface GcSnapshotDto {
  type: 'gc-snapshot';
  timestamp: number;
  collectors: GcCollectorDto[];
  totalCollections: number;
  totalCollectionTimeMs: number;
}
