export interface MethodHotspot {
  readonly className: string;
  readonly methodName: string;
  readonly samples: number;
  readonly percentage: number;
  readonly callerChain: readonly string[];
}

export interface ProfilingResultDto {
  readonly pid: string;
  readonly durationMs: number;
  readonly totalSamples: number;
  readonly hotspots: readonly MethodHotspot[];
}

export interface AutoAttachConfigDto {
  readonly enabled: boolean;
  readonly attachPhases: readonly string[];
}
