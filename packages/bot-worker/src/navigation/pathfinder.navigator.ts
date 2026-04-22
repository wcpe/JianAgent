import type { Bot } from 'mineflayer';
import { ensurePathfinder, goals } from '../behavior/pathfinder-loader.js';
import type { Navigator, NavigationTarget } from './navigator.interface.js';
import {
  resolveExecutionProfile,
  resolveGoalRadius,
  type NavigationExecutionProfile,
} from './navigation-profile.js';

export class PathfinderNavigator implements Navigator {
  readonly profile: string;

  constructor(private readonly executionProfile: NavigationExecutionProfile) {
    this.profile = executionProfile.navigationProfile;
  }

  prepare(bot: Bot): void {
    ensurePathfinder(bot);
  }

  moveTo(bot: Bot, target: NavigationTarget): void {
    this.prepare(bot);
    const radius = target.radius ?? resolveGoalRadius(this.executionProfile);
    const goal = new goals.GoalNear(
      target.x,
      target.y ?? bot.entity.position.y,
      target.z,
      radius,
    );
    (bot as any).pathfinder.setGoal(goal);
  }

  hasReached(bot: Bot, target: NavigationTarget): boolean {
    const radius = target.radius ?? resolveGoalRadius(this.executionProfile);
    const y = target.y ?? bot.entity.position.y;
    const dx = target.x - bot.entity.position.x;
    const dy = y - bot.entity.position.y;
    const dz = target.z - bot.entity.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) <= radius;
  }

  stop(bot: Bot): void {
    if ((bot as any).pathfinder) {
      (bot as any).pathfinder.setGoal(null);
    }
  }
}

export function createNavigator(
  params: Readonly<Record<string, unknown>>,
): Navigator {
  const profile = resolveExecutionProfile(params);
  return new PathfinderNavigator(profile);
}
