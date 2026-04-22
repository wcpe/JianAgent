export class BotHealthChecker {
  private readonly lastHeartbeat = new Map<string, number>();

  constructor(private readonly timeoutMs: number) {}

  recordHeartbeat(name: string): void {
    this.lastHeartbeat.set(name, Date.now());
  }

  isHealthy(name: string): boolean {
    const last = this.lastHeartbeat.get(name);
    if (last === undefined) return false;
    return Date.now() - last < this.timeoutMs;
  }

  remove(name: string): void {
    this.lastHeartbeat.delete(name);
  }

  clear(): void {
    this.lastHeartbeat.clear();
  }
}
