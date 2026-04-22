import type { BotInstanceInfo } from './bot-instance.js';

export class BotRegistry {
  private readonly bots = new Map<string, BotInstanceInfo>();

  add(info: BotInstanceInfo): void {
    this.bots.set(info.name, info);
  }

  get(name: string): BotInstanceInfo | undefined {
    return this.bots.get(name);
  }

  remove(name: string): boolean {
    return this.bots.delete(name);
  }

  all(): readonly BotInstanceInfo[] {
    return [...this.bots.values()];
  }

  names(): readonly string[] {
    return [...this.bots.keys()];
  }

  size(): number {
    return this.bots.size;
  }

  clear(): void {
    this.bots.clear();
  }
}
