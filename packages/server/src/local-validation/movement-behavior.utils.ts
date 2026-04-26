/**
 * Pure utility functions for movement-related behavior configuration
 * during local validation scenarios.
 *
 * Extracted from LocalValidationScenarioService to reduce file size.
 */

import type { BotSnapshot } from '../bot/bot-state.service.js';
import type { ScenarioStageDefinition } from './scenario-catalog.service.js';
import {
  PATROL_WAYPOINT_OFFSET,
  PATROL_WAYPOINT_WAIT_MS,
  CHAT_INTERVAL_SMOKE_MS,
  CHAT_INTERVAL_DEFAULT_MS,
} from './scenario-constants.js';

export function buildPatrolWaypoints(
  snapshot: Pick<BotSnapshot, 'x' | 'y' | 'z'>,
): readonly { x: number; y: number; z: number; waitMs?: number }[] {
  const x = Math.floor(snapshot.x);
  const y = Math.floor(snapshot.y);
  const z = Math.floor(snapshot.z);
  return [
    { x: x + PATROL_WAYPOINT_OFFSET, y, z, waitMs: PATROL_WAYPOINT_WAIT_MS },
    { x, y, z: z + PATROL_WAYPOINT_OFFSET, waitMs: PATROL_WAYPOINT_WAIT_MS },
    { x: x - PATROL_WAYPOINT_OFFSET, y, z, waitMs: PATROL_WAYPOINT_WAIT_MS },
    { x, y, z: z - PATROL_WAYPOINT_OFFSET, waitMs: PATROL_WAYPOINT_WAIT_MS },
  ];
}

export function buildMovementStageBehavior(
  stage: Pick<ScenarioStageDefinition, 'behaviorTemplate'>,
  snapshot: Pick<BotSnapshot, 'x' | 'y' | 'z'> | undefined,
): { readonly behavior: string; readonly params: Record<string, unknown> } {
  const scenarioProfile = process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'] === 'smoke' ? 'smoke' : 'default';
  const navigationProfile =
    scenarioProfile === 'smoke' ? 'pathfinder-strict' : 'pathfinder-balanced';
  const determinismLevel = scenarioProfile === 'smoke' ? 'strict' : 'balanced';

  if (stage.behaviorTemplate === 'move-random') {
    return {
      behavior: 'move-random',
      params: {
        navigationProfile,
        scenarioProfile,
        determinismLevel,
      },
    };
  }

  const waypoints = snapshot ? buildPatrolWaypoints(snapshot) : [];
  return {
    behavior: 'patrol',
    params: {
      waypoints,
      loop: true,
      navigationProfile,
      scenarioProfile,
      determinismLevel,
    },
  };
}

export function resolveMovementStageChatIntervalMs(): number {
  return process.env['LOCAL_VALIDATION_SCENARIO_PROFILE'] === 'smoke' ? CHAT_INTERVAL_SMOKE_MS : CHAT_INTERVAL_DEFAULT_MS;
}
