export interface ExceptionEventDto {
  readonly exceptionClass: string;
  readonly message: string | null;
  readonly stackTrace: readonly string[];
  readonly timestamp: number;
  readonly threadName: string;
}
