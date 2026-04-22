export class ReconnectStrategy {
  private failures = 0;

  constructor(
    private readonly maxRetries: number,
    private readonly baseDelayMs: number,
    private readonly maxDelayMs: number,
    private readonly backoffFactor: number,
  ) {}

  shouldReconnect(): boolean {
    return this.failures < this.maxRetries;
  }

  nextDelayMs(): number {
    const delay = this.baseDelayMs * Math.pow(this.backoffFactor, this.failures);
    return Math.min(delay, this.maxDelayMs);
  }

  recordFailure(): void {
    this.failures++;
  }

  reset(): void {
    this.failures = 0;
  }

  get retryCount(): number {
    return this.failures;
  }
}
