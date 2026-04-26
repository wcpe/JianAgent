import type { Bot } from 'mineflayer';
import pkg from 'mineflayer-pathfinder';

const { pathfinder, Movements, goals } = pkg;

/**
 * Ensure the pathfinder plugin is loaded on the given bot.
 * Safe to call multiple times — only loads once.
 */
export function ensurePathfinder(bot: Bot): void {
  if (!bot.pathfinder) {
    bot.loadPlugin(pathfinder);
  }
  // Apply default movements (updates each call to reflect world changes)
  const movements = new Movements(bot);
  movements.canDig = false; // Don't break blocks by default
  movements.allow1by1towers = false; // Don't pillar
  movements.allowFreeMotion = false;
  movements.allowParkour = true;
  movements.allowSprinting = true;
  bot.pathfinder.setMovements(movements);
}

export { goals, Movements };
