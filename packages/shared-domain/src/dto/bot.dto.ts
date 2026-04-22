import type { BotState } from '../enums/bot-state.js';

export interface BotConfig {
  readonly id: string;
  readonly serverHost: string;
  readonly serverPort: number;
  readonly namePattern: string;
  readonly count: number;
  readonly spawnIntervalMs: number;
  readonly connectTimeoutMs: number;
  readonly reconnectEnabled: boolean;
  readonly reconnectMaxRetries: number;
  readonly behaviorTemplate: string;
  readonly debugLevel: string;
  readonly createdAt: string;
}

export interface CreateBotGroupRequest {
  readonly serverHost: string;
  readonly serverPort: number;
  readonly namePattern: string;
  readonly count: number;
  readonly spawnIntervalMs?: number;
  readonly connectTimeoutMs?: number;
  readonly reconnectEnabled?: boolean;
  readonly reconnectMaxRetries?: number;
  readonly behaviorTemplate?: string;
  readonly debugLevel?: string;
}

export interface BotSummary {
  readonly name: string;
  readonly state: BotState;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly health: number;
  readonly food: number;
  readonly latencyMs: number;
  readonly world: string;
  readonly currentBehavior: string;
  readonly isDead: boolean;
  readonly deathCount: number;
  readonly lastHeartbeat: number;
}

export interface BotDetail extends BotSummary {
  readonly groupId: string;
  readonly workerId: string;
  readonly lastError: string | null;
  readonly lastDisconnectReason: string | null;
  readonly currentPhase: string | null;
  readonly connectedAt: string | null;
  readonly recentLogs: readonly string[];
}

export interface BotInventoryItem {
  readonly slot: number;
  readonly name: string;
  readonly displayName: string;
  readonly count: number;
  readonly maxDurability: number | null;
  readonly durabilityUsed: number | null;
}

export interface BotNearbyEntity {
  readonly id: number;
  readonly type: string;
  readonly name: string | null;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly distance: number;
  readonly health: number | null;
}

export interface BotTerrainBlock {
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly name: string;
}
