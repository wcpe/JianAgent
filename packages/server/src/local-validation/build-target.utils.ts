/**
 * Pure utility functions for resolving build targets during the
 * gather-and-place validation stage.
 *
 * These functions are stateless and require no DI — extracted from
 * LocalValidationScenarioService to reduce file size.
 */

import type { BotSnapshot } from '../bot/bot-state.service.js';
import {
  BUILD_TARGET_SURFACE_MAX_DISTANCE,
  EXCAVATED_COLUMN_MAX_DEPTH,
  EXCAVATED_COLUMN_MAX_DISTANCE,
  NON_BUILDABLE_SURFACE_BLOCKS,
} from './scenario-constants.js';

export interface TerrainBlockSnapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly name: string;
}

export function resolveBuildTarget(
  snapshot: Pick<BotSnapshot, 'x' | 'y' | 'z'>,
  preGatherTerrain: readonly TerrainBlockSnapshot[],
  terrain: readonly TerrainBlockSnapshot[],
  blockName: string,
): { x: number; y: number; z: number; blockName: string } {
  const excavatedTarget = resolveExcavatedColumnTarget(snapshot, preGatherTerrain, terrain, blockName);
  if (excavatedTarget) {
    return excavatedTarget;
  }

  const originX = Math.floor(snapshot.x);
  const originY = Math.floor(snapshot.y);
  const originZ = Math.floor(snapshot.z);
  const nearbySurface = terrain
    .filter((block) => isBuildableSurface(block.name))
    .filter((block) => !(block.x === originX && block.z === originZ))
    .map((block) => ({
      block,
      distance: Math.sqrt(
        ((block.x + 0.5) - snapshot.x) ** 2
        + ((block.z + 0.5) - snapshot.z) ** 2,
      ),
    }))
    .filter((entry) => entry.distance <= BUILD_TARGET_SURFACE_MAX_DISTANCE)
    .sort((left, right) => left.distance - right.distance)[0]?.block;

  if (nearbySurface) {
    return {
      x: nearbySurface.x,
      y: nearbySurface.y + 1,
      z: nearbySurface.z,
      blockName,
    };
  }

  return {
    x: originX + 1,
    y: originY,
    z: originZ,
    blockName,
  };
}

export function resolveExcavatedColumnTarget(
  snapshot: Pick<BotSnapshot, 'x' | 'y' | 'z'>,
  preGatherTerrain: readonly TerrainBlockSnapshot[],
  terrain: readonly TerrainBlockSnapshot[],
  blockName: string,
): { x: number; y: number; z: number; blockName: string } | null {
  if (!preGatherTerrain.length || !terrain.length) {
    return null;
  }

  const terrainByColumn = new Map(
    terrain.map((block) => [`${block.x}:${block.z}`, block] as const),
  );

  const closestExcavatedColumn = preGatherTerrain
    .filter((block) => isBuildableSurface(block.name))
    .map((before) => {
      const after = terrainByColumn.get(`${before.x}:${before.z}`);
      const depthDelta = after ? before.y - after.y : 1;
      const distance = Math.sqrt(
        ((before.x + 0.5) - snapshot.x) ** 2
        + ((before.z + 0.5) - snapshot.z) ** 2,
      );
      return {
        before,
        depthDelta,
        distance,
      };
    })
    .filter((entry) => entry.depthDelta > 0 && entry.depthDelta <= EXCAVATED_COLUMN_MAX_DEPTH)
    .filter((entry) => entry.distance <= EXCAVATED_COLUMN_MAX_DISTANCE)
    .sort((left, right) => left.distance - right.distance)[0]?.before;

  if (!closestExcavatedColumn) {
    return null;
  }

  return {
    x: closestExcavatedColumn.x,
    y: closestExcavatedColumn.y,
    z: closestExcavatedColumn.z,
    blockName,
  };
}

export function isBuildableSurface(blockName: string): boolean {
  if (blockName.endsWith('_leaves')) {
    return false;
  }

  return !NON_BUILDABLE_SURFACE_BLOCKS.has(blockName);
}

export function countInventoryItems(
  inventory: readonly { name: string; count?: number }[],
  blockName: string,
): number {
  return inventory
    .filter((item) => item.name === blockName)
    .reduce((total, item) => total + (item.count ?? 0), 0);
}

export function positionDistance(
  from: Pick<BotSnapshot, 'x' | 'y' | 'z'>,
  to: Pick<BotSnapshot, 'x' | 'y' | 'z'>,
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
