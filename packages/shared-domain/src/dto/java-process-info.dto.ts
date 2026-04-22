export interface JavaProcessInfo {
  readonly pid: number;
  readonly mainClass: string;
  readonly arguments: string;
  readonly startTime?: string;
}
