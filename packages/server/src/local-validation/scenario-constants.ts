/**
 * Constants used across local-validation scenario stages.
 *
 * Extracted from LocalValidationScenarioService to keep
 * magic numbers in one discoverable, reviewable location.
 */

// ---------------------------------------------------------------------------
// Bot state matching
// ---------------------------------------------------------------------------
export const SPAWNED_STATES = new Set(['SPAWNED', 'online']);

// ---------------------------------------------------------------------------
// General polling / timing
// ---------------------------------------------------------------------------
export const SCENARIO_POLL_INTERVAL_MS = 250;

// ---------------------------------------------------------------------------
// PVP arena geometry
// ---------------------------------------------------------------------------
export const PVP_ARENA_PLATFORM_Y = 80;
export const PVP_ARENA_CLEARANCE_Y = 85;
export const PVP_ARENA_HALF_WIDTH = 6;
export const PVP_ARENA_PAIR_SPACING = 6;
export const PVP_ARENA_OFFSET_X = 2;
export const PVP_ARENA_MIN_Z_HALF_SPAN = 4;

// ---------------------------------------------------------------------------
// PVP stage timing & combat
// ---------------------------------------------------------------------------
export const PVP_STAGE_RESPAWN_GRACE_MS = 5_000;
export const PVP_ARENA_SETTLE_DELAY_MS = 1_500;
export const PVP_ATTACK_CHASE_RANGE = 16;
export const PVP_ATTACK_RANGE = 3.5;
export const PVP_FORCED_DAMAGE_AMOUNT = 40;

// ---------------------------------------------------------------------------
// Smoke-PVP specific
// ---------------------------------------------------------------------------
export const SMOKE_PVP_FORCE_DAMAGE_DELAY_MS = 10_000;

// ---------------------------------------------------------------------------
// Movement & chat stage
// ---------------------------------------------------------------------------
export const MOVEMENT_DISTANCE_THRESHOLD = 1.5;
export const PATROL_WAYPOINT_OFFSET = 2;
export const PATROL_WAYPOINT_WAIT_MS = 200;
export const CHAT_INTERVAL_SMOKE_MS = 2_500;
export const CHAT_INTERVAL_DEFAULT_MS = 500;

// ---------------------------------------------------------------------------
// Gather & place stage
// ---------------------------------------------------------------------------
export const GATHER_RADIUS = 8;
export const BUILD_TARGET_SURFACE_MAX_DISTANCE = 3.5;
export const EXCAVATED_COLUMN_MAX_DEPTH = 2;
export const EXCAVATED_COLUMN_MAX_DISTANCE = 4.5;

// ---------------------------------------------------------------------------
// Telemetry limits
// ---------------------------------------------------------------------------
export const RECENT_CHAT_MESSAGE_LIMIT = 500;
export const RECENT_BOT_EVENT_LIMIT = 500;
export const PVP_RECENT_EVENT_LIMIT = 1_000;
export const BUILD_FAILURE_SAMPLE_LIMIT = 10;

// ---------------------------------------------------------------------------
// Non-buildable surface blocks (vegetation, flowers, vines, etc.)
// ---------------------------------------------------------------------------
export const NON_BUILDABLE_SURFACE_BLOCKS = new Set([
  'grass',
  'tall_grass',
  'short_grass',
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
  'dandelion',
  'poppy',
  'blue_orchid',
  'allium',
  'azure_bluet',
  'red_tulip',
  'orange_tulip',
  'white_tulip',
  'pink_tulip',
  'oxeye_daisy',
  'cornflower',
  'lily_of_the_valley',
  'torchflower',
]);
