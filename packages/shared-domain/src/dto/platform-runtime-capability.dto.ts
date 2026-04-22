export type StorageDialect = 'sqlite' | 'postgresql' | 'mysql';
export type LogBackendMode = 'local-file' | 'loki' | 'hybrid';
export type ProbeRuntimeKind =
  | 'paper-1.20.4'
  | 'paper-1.21+'
  | 'folia'
  | 'velocity'
  | 'fabric'
  | 'forge'
  | 'unknown';
export type RealtimeCapacityMode = 'standard' | 'high-scale';

export interface PlatformRuntimeCapabilityDto {
  readonly storageDialect: StorageDialect;
  readonly logBackendMode: LogBackendMode;
  readonly probeRuntimeKind: ProbeRuntimeKind;
  readonly realtimeCapacityMode: RealtimeCapacityMode;
}
