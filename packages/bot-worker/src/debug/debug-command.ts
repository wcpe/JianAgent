import type { Bot } from 'mineflayer';
import { safeExec } from '../util/safe-exec.js';

export interface CommandResult {
  readonly output: string;
  readonly success: boolean;
}

const COMMANDS: Record<string, (bot: Bot, args: string[]) => CommandResult> = {
  '.pos': (bot) => ({
    output: `Position: ${bot.entity.position.x.toFixed(1)}, ${bot.entity.position.y.toFixed(1)}, ${bot.entity.position.z.toFixed(1)}`,
    success: true,
  }),
  '.health': (bot) => ({
    output: `Health: ${bot.health}/20 | Food: ${bot.food}/20`,
    success: true,
  }),
  '.inv': (bot) => {
    const items = bot.inventory.items();
    const list = items.length > 0
      ? items.map((i) => `${i.name} x${i.count}`).join(', ')
      : '(empty)';
    return { output: `Inventory: ${list}`, success: true };
  },
  '.look': (bot) => ({
    output: `Yaw: ${bot.entity.yaw.toFixed(2)}, Pitch: ${bot.entity.pitch.toFixed(2)}`,
    success: true,
  }),
  '.chat': (bot, args) => {
    const message = args.join(' ');
    if (!message) return { output: 'Usage: .chat <message>', success: false };
    bot.chat(message);
    return { output: `Sent: ${message}`, success: true };
  },
  '.jump': (bot) => {
    bot.setControlState('jump', true);
    setTimeout(() => bot.setControlState('jump', false), 500);
    return { output: 'Jumping', success: true };
  },
  '.forward': (bot, args) => {
    const durationMs = args[0] ? parseInt(args[0], 10) : 1000;
    bot.setControlState('forward', true);
    setTimeout(() => { safeExec(() => bot.setControlState('forward', false), undefined); }, durationMs);
    return { output: `Moving forward for ${durationMs}ms`, success: true };
  },
  '.back': (bot, args) => {
    const durationMs = args[0] ? parseInt(args[0], 10) : 1000;
    bot.setControlState('back', true);
    setTimeout(() => { safeExec(() => bot.setControlState('back', false), undefined); }, durationMs);
    return { output: `Moving backward for ${durationMs}ms`, success: true };
  },
  '.left': (bot, args) => {
    const durationMs = args[0] ? parseInt(args[0], 10) : 1000;
    bot.setControlState('left', true);
    setTimeout(() => { safeExec(() => bot.setControlState('left', false), undefined); }, durationMs);
    return { output: `Moving left for ${durationMs}ms`, success: true };
  },
  '.right': (bot, args) => {
    const durationMs = args[0] ? parseInt(args[0], 10) : 1000;
    bot.setControlState('right', true);
    setTimeout(() => { safeExec(() => bot.setControlState('right', false), undefined); }, durationMs);
    return { output: `Moving right for ${durationMs}ms`, success: true };
  },
  '.stop': (bot) => {
    bot.clearControlStates();
    return { output: 'All movement stopped', success: true };
  },
  '.help': () => ({
    output: 'Commands: .pos .health .inv .look .chat <msg> .cmd <cmd> .jump .forward [ms] .back [ms] .left [ms] .right [ms] .stop .respawn .help',
    success: true,
  }),
  '.cmd': (bot, args) => {
    const command = args.join(' ');
    if (!command) return { output: 'Usage: .cmd <command>', success: false };
    bot.chat(`/${command}`);
    return { output: `Executed: /${command}`, success: true };
  },
  '.respawn': (bot) => {
    try {
      bot.respawn();
      return { output: 'Respawn requested', success: true };
    } catch (err: unknown) {
      return { output: `Respawn failed: ${err instanceof Error ? err.message : String(err)}`, success: false };
    }
  },
};

export function executeDebugCommand(bot: Bot, input: string): CommandResult {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);
  const handler = COMMANDS[cmd];
  if (!handler) {
    return { output: `Unknown command: ${cmd}. Type .help for list.`, success: false };
  }
  try {
    return handler(bot, args);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { output: `Error: ${message}`, success: false };
  }
}
