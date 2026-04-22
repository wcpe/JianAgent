import type { BotInstanceInfo } from '../registry/bot-instance.js';
import type { BehaviorEngine } from '../behavior/behavior-engine.js';
import type { BehaviorContext } from '../behavior/behavior.interface.js';
import { BehaviorFactory } from '../behavior/behavior-factory.js';
import { executeDebugCommand } from './debug-command.js';

export class DebugSession {
  private previousBehaviorName: string | null = null;

  constructor(
    private readonly botInstance: BotInstanceInfo,
    private readonly engine: BehaviorEngine,
    private readonly onOutput: (botName: string, output: string) => void,
  ) {}

  get botName(): string {
    return this.botInstance.name;
  }

  async enter(): Promise<void> {
    this.previousBehaviorName = this.botInstance.currentBehavior?.name ?? null;
    const bot = this.botInstance.bot;
    if (bot) {
      await this.engine.stopCurrent({ bot, params: {} });
    }
    this.botInstance.state = 'DEBUGGING' as any;
    this.onOutput(this.botName, 'Entered debug mode for ' + this.botName + '\r\n');
  }

  async executeCommand(command: string): Promise<void> {
    const bot = this.botInstance.bot;
    if (!bot) {
      this.onOutput(this.botName, 'Error: Bot not connected\r\n');
      return;
    }
    const result = executeDebugCommand(bot, command);
    this.onOutput(this.botName, result.output + '\r\n');
  }

  async exit(): Promise<void> {
    const bot = this.botInstance.bot;
    if (bot && this.previousBehaviorName) {
      try {
        const behavior = BehaviorFactory.create(this.previousBehaviorName);
        const ctx: BehaviorContext = { bot, params: {} };
        await this.engine.switchBehavior(behavior, ctx);
        this.botInstance.currentBehavior = behavior;
      } catch {
        // behavior restore failed, that's ok
      }
    }
    this.botInstance.state = 'CONNECTED' as any;
    this.onOutput(this.botName, 'Exited debug mode\r\n');
    this.previousBehaviorName = null;
  }
}
