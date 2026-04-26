import { Vec3 } from 'vec3';
import type { BehaviorContext } from '../behavior/behavior.interface.js';
import { ensurePathfinder, goals } from '../behavior/pathfinder-loader.js';

export type WorldActionPhase = 'idle' | 'approaching' | 'acting' | 'cooldown';
export type WorldActionStatus = 'idle' | 'approaching' | 'acting' | 'cooldown' | 'completed' | 'blocked';

export interface WorldActionPlannerState {
  readonly currentTargetKey: string | null;
  readonly phase: WorldActionPhase;
  readonly lastAttemptAt: number | null;
  readonly retryCount: number;
  readonly cooldownUntil: number | null;
  readonly lastFailureReason: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface WorldActionPlannerResult {
  readonly status: WorldActionStatus;
  readonly state: WorldActionPlannerState;
  readonly target?: Readonly<Record<string, unknown>>;
  readonly action?: string;
  readonly shouldAdvance: boolean;
  readonly shouldStopMovement: boolean;
  readonly failureReason?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

interface PlannerTarget {
  readonly x: number;
  readonly y?: number;
  readonly z: number;
  readonly radius?: number;
}

interface GatherPlannerConfig {
  readonly blockTypes: readonly string[];
  readonly radius: number;
  readonly approachRadius?: number;
  readonly digDistance?: number;
  readonly cooldownMs?: number;
}

export interface BuildPlannerAction {
  readonly type: 'place' | 'break';
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly blockName?: string;
}

type BuildFailureReason =
  | 'missing-inventory'
  | 'occupied-target'
  | 'standing-position'
  | 'reference-face'
  | 'target-blocked'
  | 'line-of-sight'
  | 'unknown';

interface BuildPlannerConfig {
  readonly action: BuildPlannerAction;
  readonly cooldownMs?: number;
}

interface AttackPlannerConfig {
  readonly target?: string;
  readonly chaseRange: number;
  readonly attackRange: number;
  readonly cooldownMs: number;
  readonly chaseUpdateMs?: number;
}

interface GatherTargetBlock {
  readonly name?: string;
  readonly position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
}

const DEFAULT_COOLDOWN_MS = 750;
const BUILD_REPLACEABLE_BLOCK_NAMES = new Set([
  'air',
  'void_air',
  'cave_air',
  'grass',
  'short_grass',
  'tall_grass',
  'fern',
  'large_fern',
  'vine',
  'cave_vines',
  'cave_vines_plant',
  'weeping_vines',
  'weeping_vines_plant',
  'twisting_vines',
  'twisting_vines_plant',
  'dead_bush',
  'snow',
  'water',
  'lava',
]);

export function createWorldActionPlannerState(
  overrides: Partial<WorldActionPlannerState> = {},
): WorldActionPlannerState {
  return {
    currentTargetKey: overrides.currentTargetKey ?? null,
    phase: overrides.phase ?? 'idle',
    lastAttemptAt: overrides.lastAttemptAt ?? null,
    retryCount: overrides.retryCount ?? 0,
    cooldownUntil: overrides.cooldownUntil ?? null,
    lastFailureReason: overrides.lastFailureReason ?? null,
    metadata: overrides.metadata ?? {},
  };
}

export function moveBotTo(ctx: BehaviorContext, target: PlannerTarget): void {
  if (ctx.navigator) {
    ctx.navigator.moveTo(ctx.bot, target);
    return;
  }

  ensurePathfinder(ctx.bot);
  const goal = new goals.GoalNear(
    target.x,
    target.y ?? ctx.bot.entity.position.y,
    target.z,
    target.radius ?? 1,
  );
  ctx.bot.pathfinder.setGoal(goal);
}

export function stopBotMovement(ctx: BehaviorContext): void {
  if (ctx.navigator) {
    ctx.navigator.stop(ctx.bot);
    return;
  }

  if (ctx.bot.pathfinder) {
    ctx.bot.pathfinder.setGoal(null);
  }
}

export async function planGatherTick(
  ctx: BehaviorContext,
  state: WorldActionPlannerState,
  config: GatherPlannerConfig,
): Promise<WorldActionPlannerResult> {
  const cooldown = resolveCooldownState(state);
  if (cooldown) {
    return cooldown;
  }

  const block = ctx.bot.findBlock({
    matching: (candidate) => config.blockTypes.includes(candidate.name),
    maxDistance: config.radius,
  });

  if (!block) {
    if (state.currentTargetKey) {
      stopBotMovement(ctx);
    }
    return createResult('idle', resetState(), {
      shouldStopMovement: true,
    });
  }

  const targetKey = serializePositionKey(block.position);
  const distance = resolveDistance(ctx.bot.entity.position, block.position);
  const digDistance = config.digDistance ?? 4;
  if (distance > digDistance) {
    if (state.currentTargetKey !== targetKey || state.phase !== 'approaching') {
      moveBotTo(ctx, {
        x: block.position.x,
        y: block.position.y,
        z: block.position.z,
        radius: config.approachRadius ?? 2,
      });
    }
    return createResult('approaching', {
      ...state,
      currentTargetKey: targetKey,
      phase: 'approaching',
      metadata: {
        blockName: block.name ?? config.blockTypes[0] ?? 'unknown',
      },
    }, {
      target: {
        x: block.position.x,
        y: block.position.y,
        z: block.position.z,
      },
    });
  }

  stopBotMovement(ctx);

  try {
    await ctx.bot.dig(block);
    return createResult('completed', {
      ...resetState(),
      lastAttemptAt: Date.now(),
    }, {
      action: 'dig',
      shouldStopMovement: true,
      target: {
        x: block.position.x,
        y: block.position.y,
        z: block.position.z,
      },
    });
  } catch {
    return createCooldownResult(state, config.cooldownMs ?? DEFAULT_COOLDOWN_MS, 'dig-failed', {
      target: {
        x: block.position.x,
        y: block.position.y,
        z: block.position.z,
      },
      action: 'dig',
    });
  }
}

export async function planBuildTick(
  ctx: BehaviorContext,
  state: WorldActionPlannerState,
  config: BuildPlannerConfig,
): Promise<WorldActionPlannerResult> {
  const cooldown = resolveCooldownState(state);
  if (cooldown) {
    return cooldown;
  }

  const { action } = config;
  const pos = ctx.bot.entity.position;
  const targetCenter = { x: action.x + 0.5, y: action.y + 0.5, z: action.z + 0.5 };
  const dist = resolveDistance(pos, targetCenter);

  if (action.type === 'place' && isOccupyingTargetColumn(pos, action)) {
    const standPosition = resolveStandPosition(action);
    reportBuildFailure(ctx, action, 'occupied-target', 'occupied target column before place attempt', {
      standingPosition: standPosition,
      botPosition: serializePosition(pos),
    });
    moveBotTo(ctx, {
      x: standPosition.x,
      y: standPosition.y,
      z: standPosition.z,
      radius: 1,
    });
    return createResult('approaching', {
      ...state,
      currentTargetKey: serializePositionKey(standPosition),
      phase: 'approaching',
      lastFailureReason: 'occupied-target',
      metadata: {
        actionType: action.type,
      },
    }, {
      target: standPosition,
      failureReason: 'occupied-target',
      metadata: {
        target: serializeBuildTarget(action),
      },
    });
  }

  if (dist > 3.5) {
    const target = { x: action.x, y: action.y, z: action.z, radius: 1 };
    const targetKey = serializePositionKey(target);
    if (state.currentTargetKey !== targetKey || state.phase !== 'approaching') {
      moveBotTo(ctx, target);
    }
    return createResult('approaching', {
      ...state,
      currentTargetKey: targetKey,
      phase: 'approaching',
      metadata: {
        actionType: action.type,
      },
    }, {
      target: serializeBuildTarget(action),
    });
  }

  stopBotMovement(ctx);

  if (action.type === 'break') {
    const targetBlock = ctx.bot.blockAt(new Vec3(action.x, action.y, action.z));
    if (!targetBlock || targetBlock.name === 'air') {
      return createResult('blocked', {
        ...state,
        phase: 'idle',
        lastFailureReason: 'target-blocked',
      }, {
        action: 'break',
        failureReason: 'target-blocked',
        shouldStopMovement: true,
        target: serializeBuildTarget(action),
      });
    }
    await ctx.bot.dig(targetBlock);
    return createResult('completed', {
      ...resetState(),
      lastAttemptAt: Date.now(),
    }, {
      action: 'break',
      shouldAdvance: true,
      shouldStopMovement: true,
      target: serializeBuildTarget(action),
    });
  }

  return attemptBuildPlace(ctx, state, config);
}

export async function planAttackTick(
  ctx: BehaviorContext,
  state: WorldActionPlannerState,
  config: AttackPlannerConfig,
): Promise<WorldActionPlannerResult> {
  const cooldown = resolveCooldownState(state);
  if (cooldown) {
    return cooldown;
  }

  const entity = selectAttackTarget(ctx, config.target);
  if (!entity) {
    stopBotMovement(ctx);
    return createResult('idle', resetState(), {
      shouldStopMovement: true,
    });
  }

  const dist = ctx.bot.entity.position.distanceTo(entity.position);
  const targetKey = resolveEntityKey(entity);
  const lastChaseUpdate = Number(state.metadata['lastChaseUpdate'] ?? 0);

  if (dist > config.attackRange) {
    if (dist >= config.chaseRange) {
      stopBotMovement(ctx);
      return createResult('blocked', {
        ...state,
        currentTargetKey: targetKey,
        phase: 'idle',
        lastFailureReason: 'out-of-range',
      }, {
        failureReason: 'out-of-range',
        shouldStopMovement: true,
        target: {
          key: targetKey,
        },
      });
    }

    if (Date.now() - lastChaseUpdate >= (config.chaseUpdateMs ?? 400)) {
      moveBotTo(ctx, {
        x: entity.position.x,
        y: entity.position.y,
        z: entity.position.z,
        radius: Math.max(1, Math.floor(config.attackRange - 0.5)),
      });
    }

    return createResult('approaching', {
      ...state,
      currentTargetKey: targetKey,
      phase: 'approaching',
      metadata: {
        lastChaseUpdate: Date.now(),
      },
    }, {
      target: {
        key: targetKey,
        x: entity.position.x,
        y: entity.position.y,
        z: entity.position.z,
      },
      action: 'chase',
    });
  }

  stopBotMovement(ctx);
  await ctx.bot.lookAt(entity.position.offset(0, entity.height * 0.8, 0));
  await ctx.bot.attack(entity);

  return createResult('completed', {
    ...state,
    currentTargetKey: targetKey,
    phase: 'cooldown',
    lastAttemptAt: Date.now(),
    cooldownUntil: Date.now() + config.cooldownMs,
    lastFailureReason: null,
  }, {
    action: 'attack',
    shouldStopMovement: true,
    target: {
      key: targetKey,
      x: entity.position.x,
      y: entity.position.y,
      z: entity.position.z,
    },
  });
}

function resolveCooldownState(
  state: WorldActionPlannerState,
): WorldActionPlannerResult | null {
  if (!state.cooldownUntil || state.cooldownUntil <= Date.now()) {
    return null;
  }

  return createResult('cooldown', state, {
    failureReason: state.lastFailureReason ?? undefined,
  });
}

async function attemptBuildPlace(
  ctx: BehaviorContext,
  state: WorldActionPlannerState,
  config: BuildPlannerConfig,
): Promise<WorldActionPlannerResult> {
  const { action } = config;
  const blockName = action.blockName;
  if (!blockName) {
    reportBuildFailure(ctx, action, 'missing-inventory', 'no blockName configured for build action');
    return createResult('blocked', {
      ...state,
      phase: 'idle',
      lastFailureReason: 'missing-inventory',
    }, {
      action: 'place',
      failureReason: 'missing-inventory',
      shouldStopMovement: true,
      target: serializeBuildTarget(action),
    });
  }

  const item = ctx.bot.inventory.items().find((inventoryItem) => inventoryItem.name === blockName);
  if (!item) {
    reportBuildFailure(ctx, action, 'missing-inventory', `missing inventory item ${blockName}`);
    return createResult('blocked', {
      ...state,
      phase: 'idle',
      lastFailureReason: 'missing-inventory',
    }, {
      action: 'place',
      failureReason: 'missing-inventory',
      shouldStopMovement: true,
      target: serializeBuildTarget(action),
    });
  }

  const targetPosition = new Vec3(action.x, action.y, action.z);
  const targetBlock = ctx.bot.blockAt(targetPosition);
  if (targetBlock?.name === blockName) {
    reportBuildSuccess(ctx, action, 'target already matches requested block');
    return createResult('completed', {
      ...resetState(),
      lastAttemptAt: Date.now(),
    }, {
      action: 'place',
      shouldAdvance: true,
      shouldStopMovement: true,
      target: serializeBuildTarget(action),
    });
  }
  if (targetBlock && !isReplaceableBlock(targetBlock.name)) {
    reportBuildFailure(ctx, action, 'target-blocked', `target blocked by ${targetBlock.name}`, {
      targetBlock: {
        name: targetBlock.name,
        position: serializePosition(targetBlock.position),
      },
    });
    return createResult('blocked', {
      ...state,
      phase: 'idle',
      lastFailureReason: 'target-blocked',
    }, {
      action: 'place',
      failureReason: 'target-blocked',
      shouldStopMovement: true,
      target: serializeBuildTarget(action),
    });
  }

  const placementReference = resolvePlacementReference(ctx, action);
  if (!placementReference) {
    reportBuildFailure(ctx, action, 'reference-face', 'no solid reference face available for place attempt');
    return createResult('blocked', {
      ...state,
      phase: 'idle',
      lastFailureReason: 'reference-face',
    }, {
      action: 'place',
      failureReason: 'reference-face',
      shouldStopMovement: true,
      target: serializeBuildTarget(action),
    });
  }

  const placementMetadata = {
    target: serializeBuildTarget(action),
    referenceFace: serializePosition(placementReference.face),
    referenceBlock: {
      name: placementReference.refBlock.name,
      position: serializePosition(placementReference.refBlock.position),
    },
    botPosition: serializePosition(ctx.bot.entity.position),
  };
  ctx.reportEvent?.('BUILD_ATTEMPT', 'build place attempt started', placementMetadata);

  try {
    await ctx.bot.equip(item, 'hand');
    if (placementReference.refBlock.position) {
      await ctx.bot.lookAt(new Vec3(
        placementReference.refBlock.position.x + 0.5 + (placementReference.face.x * 0.5),
        placementReference.refBlock.position.y + 0.5 + (placementReference.face.y * 0.5),
        placementReference.refBlock.position.z + 0.5 + (placementReference.face.z * 0.5),
      ));
    }

    await ctx.bot.placeBlock(placementReference.refBlock, placementReference.face);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failureReason = resolvePlaceFailureReason(message);
    reportBuildFailure(ctx, action, failureReason, message, placementMetadata);
    return createCooldownResult(state, config.cooldownMs ?? DEFAULT_COOLDOWN_MS, failureReason, {
      action: 'place',
      target: serializeBuildTarget(action),
      metadata: placementMetadata,
    });
  }

  const placed = ctx.bot.blockAt(targetPosition)?.name === blockName;
  if (placed) {
    reportBuildSuccess(ctx, action, 'build place attempt confirmed in world state', placementMetadata);
    return createResult('completed', {
      ...resetState(),
      lastAttemptAt: Date.now(),
    }, {
      action: 'place',
      shouldAdvance: true,
      shouldStopMovement: true,
      target: serializeBuildTarget(action),
      metadata: placementMetadata,
    });
  }

  reportBuildFailure(
    ctx,
    action,
    'unknown',
    'place attempt finished without target block confirmation',
    placementMetadata,
  );
  return createCooldownResult(state, config.cooldownMs ?? DEFAULT_COOLDOWN_MS, 'unknown', {
    action: 'place',
    target: serializeBuildTarget(action),
    metadata: placementMetadata,
  });
}

function createCooldownResult(
  state: WorldActionPlannerState,
  cooldownMs: number,
  failureReason: string,
  options: {
    readonly target?: Readonly<Record<string, unknown>>;
    readonly action?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  } = {},
): WorldActionPlannerResult {
  return createResult('cooldown', {
    ...state,
    phase: 'cooldown',
    lastAttemptAt: Date.now(),
    cooldownUntil: Date.now() + cooldownMs,
    retryCount: state.retryCount + 1,
    lastFailureReason: failureReason,
  }, {
    failureReason,
    target: options.target,
    action: options.action,
    metadata: options.metadata,
  });
}

function createResult(
  status: WorldActionStatus,
  state: WorldActionPlannerState,
  options: {
    readonly target?: Readonly<Record<string, unknown>>;
    readonly action?: string;
    readonly shouldAdvance?: boolean;
    readonly shouldStopMovement?: boolean;
    readonly failureReason?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  } = {},
): WorldActionPlannerResult {
  return {
    status,
    state,
    target: options.target,
    action: options.action,
    shouldAdvance: options.shouldAdvance ?? false,
    shouldStopMovement: options.shouldStopMovement ?? false,
    failureReason: options.failureReason,
    metadata: options.metadata,
  };
}

function resetState(): WorldActionPlannerState {
  return createWorldActionPlannerState();
}

function selectAttackTarget(ctx: BehaviorContext, target?: string) {
  return target
    ? ctx.bot.nearestEntity((entity) => entity.username === target || entity.name === target)
    : ctx.bot.nearestEntity((entity) => (entity.type === 'mob' || entity.type === 'player') && entity.username !== ctx.bot.username);
}

function resolveEntityKey(entity: { username?: string; name?: string; position: { x: number; y: number; z: number } }): string {
  return entity.username ?? entity.name ?? `${entity.position.x}:${entity.position.y}:${entity.position.z}`;
}

function serializePositionKey(position: { x: number; y?: number; z: number }): string {
  return `${position.x}:${position.y ?? 0}:${position.z}`;
}

function resolveDistance(
  source: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
): number {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dz = target.z - source.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function isReplaceableBlock(blockName: string): boolean {
  return BUILD_REPLACEABLE_BLOCK_NAMES.has(blockName);
}

function resolvePlacementReference(
  ctx: BehaviorContext,
  action: BuildPlannerAction,
) {
  const references = [
    { position: new Vec3(action.x, action.y - 1, action.z), face: new Vec3(0, 1, 0) },
    { position: new Vec3(action.x - 1, action.y, action.z), face: new Vec3(1, 0, 0) },
    { position: new Vec3(action.x + 1, action.y, action.z), face: new Vec3(-1, 0, 0) },
    { position: new Vec3(action.x, action.y, action.z - 1), face: new Vec3(0, 0, 1) },
    { position: new Vec3(action.x, action.y, action.z + 1), face: new Vec3(0, 0, -1) },
  ];

  for (const candidate of references) {
    const refBlock = ctx.bot.blockAt(candidate.position);
    if (!refBlock || isReplaceableBlock(refBlock.name)) {
      continue;
    }
    return {
      refBlock,
      face: candidate.face,
    };
  }

  return null;
}

function isOccupyingTargetColumn(
  position: { x: number; y: number; z: number },
  action: BuildPlannerAction,
): boolean {
  return Math.floor(position.x) === action.x
    && Math.floor(position.z) === action.z
    && Math.abs(position.y - action.y) <= 1.5;
}

function resolveStandPosition(action: BuildPlannerAction): { readonly x: number; readonly y: number; readonly z: number } {
  return {
    x: action.x + 2,
    y: action.y,
    z: action.z,
  };
}

function resolvePlaceFailureReason(message: string): BuildFailureReason {
  const normalized = message.toLowerCase();
  if (normalized.includes('line of sight')) {
    return 'line-of-sight';
  }
  if (normalized.includes('reference')) {
    return 'reference-face';
  }
  return 'unknown';
}

function reportBuildFailure(
  ctx: BehaviorContext,
  action: BuildPlannerAction,
  reason: BuildFailureReason,
  message: string,
  metadata?: Readonly<Record<string, unknown>>,
): void {
  ctx.reportEvent?.('BUILD_FAILURE', message, {
    reason,
    target: serializeBuildTarget(action),
    ...metadata,
  });
}

function reportBuildSuccess(
  ctx: BehaviorContext,
  action: BuildPlannerAction,
  message: string,
  metadata?: Readonly<Record<string, unknown>>,
): void {
  ctx.reportEvent?.('BUILD_SUCCESS', message, {
    target: serializeBuildTarget(action),
    ...metadata,
  });
}

function serializeBuildTarget(
  action: BuildPlannerAction,
): { readonly x: number; readonly y: number; readonly z: number; readonly blockName?: string } {
  return {
    x: action.x,
    y: action.y,
    z: action.z,
    blockName: action.blockName,
  };
}

function serializePosition(
  position: { x: number; y: number; z: number },
): { readonly x: number; readonly y: number; readonly z: number } {
  return {
    x: position.x,
    y: position.y,
    z: position.z,
  };
}
