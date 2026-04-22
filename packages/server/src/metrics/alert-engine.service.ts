import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { AlertLevel, ServerState } from '@jian-agent/shared-domain';
import type { AlertRuleDto, AlertDto, ProbeSnapshotDto } from '@jian-agent/shared-domain';
import type { AlertPayload } from '@jian-agent/shared-protocol';
import { AlertStoreService } from './alert-store.service.js';

interface CooldownEntry {
  readonly ruleId: string;
  readonly firedAt: number;
}

@Injectable()
export class AlertEngineService extends EventEmitter implements OnModuleInit {
  private readonly logger = new Logger(AlertEngineService.name);
  private rules: AlertRuleDto[] = [];
  private readonly cooldowns = new Map<string, CooldownEntry>();

  constructor(private readonly alertStore: AlertStoreService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.reloadRules();
  }

  async reloadRules(): Promise<void> {
    this.rules = await this.alertStore.getEnabledRules();
    this.logger.log(`Loaded ${this.rules.length} alert rules`);
  }

  async evaluateSnapshot(serverId: string, snapshot: ProbeSnapshotDto): Promise<void> {
    for (const rule of this.rules) {
      const value = this.extractMetric(rule.metric, snapshot);
      if (value === null) continue;

      if (this.evaluate(value, rule.operator, rule.threshold)) {
        await this.fireRuleAlert(rule, value, serverId);
      }
    }
  }

  checkServerState(state: ServerState): void {
    if (state === ServerState.CRASHED) {
      this.emitLegacyAlert(AlertLevel.CRITICAL, 'server', 'Server process crashed');
    }
  }

  async getRecentAlerts(limit = 50): Promise<AlertDto[]> {
    return this.alertStore.listAlerts(limit);
  }

  async getSummary() {
    return this.alertStore.getSummary();
  }

  async acknowledgeAlert(id: string) {
    return this.alertStore.acknowledgeAlert(id);
  }

  async fireJmxThresholdAlert(input: {
    serverId: string;
    metric: 'HEAP_USED_MB' | 'THREAD_COUNT';
    value: number;
    threshold: number;
    level?: AlertLevel;
    cooldownSeconds?: number;
  }): Promise<void> {
    const cooldownSeconds = input.cooldownSeconds ?? 60;
    const key = `jmx:${input.serverId}:${input.metric}`;
    const now = Date.now();
    const cooldown = this.cooldowns.get(key);
    if (cooldown && now - cooldown.firedAt < cooldownSeconds * 1000) {
      return;
    }

    this.cooldowns.set(key, { ruleId: key, firedAt: now });

    const alertDto: Omit<AlertDto, 'id'> = {
      timestamp: new Date().toISOString(),
      level: input.level ?? AlertLevel.WARNING,
      ruleId: key,
      ruleName: `JMX ${input.metric}`,
      message: `${input.metric} > ${input.threshold} (actual: ${input.value})`,
      serverId: input.serverId,
      value: input.value,
      threshold: input.threshold,
      acknowledged: false,
    };

    const id = await this.alertStore.insertAlert(alertDto);
    this.emit('alert.fired', { ...alertDto, id });
  }

  private extractMetric(metric: string, snapshot: ProbeSnapshotDto): number | null {
    switch (metric) {
      case 'TPS': return snapshot.tps;
      case 'MSPT': return snapshot.mspt;
      case 'MEMORY_USAGE': {
        const used = snapshot.totalMemoryMb - snapshot.freeMemoryMb;
        return snapshot.totalMemoryMb > 0 ? (used / snapshot.totalMemoryMb) * 100 : null;
      }
      case 'PLAYER_COUNT': return snapshot.onlinePlayers;
      case 'ENTITY_COUNT': return snapshot.entityCount;
      case 'LOADED_CHUNKS': return snapshot.loadedChunks;
      default: return null;
    }
  }

  private evaluate(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'LESS_THAN': return value < threshold;
      case 'GREATER_THAN': return value > threshold;
      case 'EQUALS': return value === threshold;
      default: return false;
    }
  }

  private async fireRuleAlert(rule: AlertRuleDto, value: number, serverId: string): Promise<void> {
    const now = Date.now();
    const cooldown = this.cooldowns.get(rule.id);
    if (cooldown && now - cooldown.firedAt < rule.cooldownSeconds * 1000) {
      return;
    }

    this.cooldowns.set(rule.id, { ruleId: rule.id, firedAt: now });

    const alertDto: Omit<AlertDto, 'id'> = {
      timestamp: new Date().toISOString(),
      level: rule.level,
      ruleId: rule.id,
      ruleName: rule.name,
      message: `${rule.metric} ${rule.operator} ${rule.threshold} (actual: ${value})`,
      serverId,
      value,
      threshold: rule.threshold,
      acknowledged: false,
    };

    const id = await this.alertStore.insertAlert(alertDto);
    const fullAlert: AlertDto = { ...alertDto, id };

    this.emit('alert.fired', fullAlert);
    this.logger.warn(`Alert [${rule.level}] ${rule.name}: ${alertDto.message}`);
  }

  private emitLegacyAlert(level: AlertLevel, source: string, message: string, details?: string): void {
    const alert: AlertPayload = {
      id: randomUUID(),
      level,
      source,
      message,
      timestamp: new Date().toISOString(),
      details,
    };
    this.emit('alert', alert);
    this.logger.warn(`Alert [${level}] ${source}: ${message}`);
  }
}
