export type DiagnosticsEvent =
  | {
      kind: 'raw';
      text: string;
      ts: number;
    }
  | {
      kind: 'structured';
      payload: unknown;
      ts: number;
    };

export interface DiagnosticsViewState {
  readonly events: readonly DiagnosticsEvent[];
  pushEvent: (event: DiagnosticsEvent) => void;
  clearEvents: () => void;
}

export type ParsedDiagnosticsType = 
  | 'raw' 
  | 'version' 
  | 'dashboard' 
  | 'thread' 
  | 'jvm'
  | 'sc'
  | 'sm'
  | 'jad'
  | 'watch'
  | 'trace'
  | 'stack'
  | 'tt'
  | 'monitor'
  | 'profiler'
  | 'heapdump'
  | 'memory'
  | 'sysprop'
  | 'sysenv'
  | 'vmoption'
  | 'logger';

export interface ParsedDiagnosticsView {
  readonly type: ParsedDiagnosticsType;
  readonly data?: unknown;
  readonly raw: string;
}
