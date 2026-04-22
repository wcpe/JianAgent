export interface DebugRecordingDto {
  readonly id: string;
  readonly sessionId: string;
  readonly serverId: string;
  readonly startedAt: number;
  readonly stoppedAt: number | null;
  readonly sizeBytes: number;
  readonly eventCount: number;
  readonly status: 'recording' | 'completed' | 'error';
}

export interface DebugRecordingEventDto {
  readonly id: number;
  readonly recordingId: string;
  readonly offsetMs: number;
  readonly eventType: 'output' | 'input' | 'resize';
  readonly data: string;
}
