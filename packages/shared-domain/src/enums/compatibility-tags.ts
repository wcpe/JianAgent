/**
 * Resource compatibility tags — indicates which features a resource type supports.
 * Used for read-only display in the UI to show platform capabilities.
 */
export const ResourceCompatibilityTag = {
  TERMINAL: 'terminal',
  FILES: 'files',
  PLUGINS: 'plugins',
  LOGS: 'logs',
  AUDIT: 'audit',
  JVM: 'jvm',
  MONITORING: 'monitoring',
  PLAYER_MANAGEMENT: 'player-management',
  MOTD: 'motd',
  WHITELIST: 'whitelist',
  OPERATORS: 'operators',
  PAUSE_PLAYERS: 'pause-players',
} as const;

export type ResourceCompatibilityTag = (typeof ResourceCompatibilityTag)[keyof typeof ResourceCompatibilityTag];

/**
 * Compatibility matrix: maps resource types to their supported feature tags.
 * This is the source of truth for which features are available per platform.
 */
export const COMPATIBILITY_MATRIX: Record<string, ResourceCompatibilityTag[]> = {
  // Minecraft server — full feature set
  Minecraft: [
    ResourceCompatibilityTag.TERMINAL,
    ResourceCompatibilityTag.FILES,
    ResourceCompatibilityTag.PLUGINS,
    ResourceCompatibilityTag.LOGS,
    ResourceCompatibilityTag.AUDIT,
    ResourceCompatibilityTag.JVM,
    ResourceCompatibilityTag.MONITORING,
    ResourceCompatibilityTag.PLAYER_MANAGEMENT,
    ResourceCompatibilityTag.MOTD,
    ResourceCompatibilityTag.WHITELIST,
    ResourceCompatibilityTag.OPERATORS,
    ResourceCompatibilityTag.PAUSE_PLAYERS,
  ],

  // Velocity proxy — core features, no player management extras
  VelocityProxy: [
    ResourceCompatibilityTag.TERMINAL,
    ResourceCompatibilityTag.FILES,
    ResourceCompatibilityTag.PLUGINS,
    ResourceCompatibilityTag.LOGS,
    ResourceCompatibilityTag.JVM,
  ],

  // Waterfall proxy — same as Velocity
  WaterfallProxy: [
    ResourceCompatibilityTag.TERMINAL,
    ResourceCompatibilityTag.FILES,
    ResourceCompatibilityTag.PLUGINS,
    ResourceCompatibilityTag.LOGS,
    ResourceCompatibilityTag.JVM,
  ],

  // Generic JVM application — no plugins or player management
  GenericJVM: [
    ResourceCompatibilityTag.TERMINAL,
    ResourceCompatibilityTag.FILES,
    ResourceCompatibilityTag.LOGS,
    ResourceCompatibilityTag.JVM,
    ResourceCompatibilityTag.MONITORING,
  ],

  // Docker container — minimal feature set
  DockerContainer: [
    ResourceCompatibilityTag.TERMINAL,
    ResourceCompatibilityTag.FILES,
  ],
} as const;