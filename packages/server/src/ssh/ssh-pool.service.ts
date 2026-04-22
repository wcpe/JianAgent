import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Client } from 'ssh2';
import { readFileSync } from 'node:fs';
import { SshCryptoService } from './ssh-crypto.service.js';
import type { SshConnectConfig } from '@jian-agent/shared-domain';

interface PoolEntry {
  readonly client: Client;
  readonly serverId: string;
  refCount: number;
  lastUsed: number;
  alive: boolean;
}

const MAX_CONNECTIONS_PER_SERVER = 3;
const IDLE_TIMEOUT_MS = 60_000;
const HEALTH_CHECK_INTERVAL_MS = 30_000;
const CONNECT_TIMEOUT_MS = 15_000;

@Injectable()
export class SshPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(SshPoolService.name);
  private readonly pools = new Map<string, PoolEntry[]>();
  private readonly healthTimer: ReturnType<typeof setInterval>;

  constructor(private readonly crypto: SshCryptoService) {
    this.healthTimer = setInterval(() => this.healthCheck(), HEALTH_CHECK_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    clearInterval(this.healthTimer);
    this.destroyAll();
  }

  async getConnection(config: SshConnectConfig): Promise<Client> {
    const entries = this.pools.get(config.id) ?? [];

    // Reuse idle alive connection
    const idle = entries.find((e) => e.alive && e.refCount === 0);
    if (idle) {
      idle.refCount++;
      idle.lastUsed = Date.now();
      return idle.client;
    }

    // Create new if under limit
    if (entries.length < MAX_CONNECTIONS_PER_SERVER) {
      const client = await this.connect(config);
      const entry: PoolEntry = { client, serverId: config.id, refCount: 1, lastUsed: Date.now(), alive: true };
      entries.push(entry);
      this.pools.set(config.id, entries);
      return client;
    }

    // Reuse busiest alive connection
    const alive = entries.filter((e) => e.alive);
    if (alive.length > 0) {
      const best = alive.reduce((a, b) => (a.refCount <= b.refCount ? a : b));
      best.refCount++;
      best.lastUsed = Date.now();
      return best.client;
    }

    // All dead — clean up and create fresh
    this.destroyServer(config.id);
    const client = await this.connect(config);
    const entry: PoolEntry = { client, serverId: config.id, refCount: 1, lastUsed: Date.now(), alive: true };
    this.pools.set(config.id, [entry]);
    return client;
  }

  release(serverId: string, client: Client): void {
    const entries = this.pools.get(serverId);
    if (!entries) return;
    const entry = entries.find((e) => e.client === client);
    if (entry && entry.refCount > 0) {
      entry.refCount--;
      entry.lastUsed = Date.now();
    }
  }

  destroyServer(serverId: string): void {
    const entries = this.pools.get(serverId);
    if (!entries) return;
    for (const entry of entries) {
      entry.alive = false;
      try { entry.client.end(); } catch { /* ignore */ }
    }
    this.pools.delete(serverId);
  }

  destroyAll(): void {
    for (const serverId of [...this.pools.keys()]) {
      this.destroyServer(serverId);
    }
  }

  isConnected(serverId: string): boolean {
    const entries = this.pools.get(serverId);
    return entries ? entries.some((e) => e.alive) : false;
  }

  private async connect(config: SshConnectConfig): Promise<Client> {
    return new Promise<Client>((resolve, reject) => {
      const client = new Client();
      const timer = setTimeout(() => {
        client.end();
        reject(new Error(`SSH connection timeout after ${CONNECT_TIMEOUT_MS}ms`));
      }, CONNECT_TIMEOUT_MS);

      client.on('ready', () => {
        clearTimeout(timer);
        this.logger.log(`SSH connected to ${config.host}:${config.port} (server=${config.id})`);
        resolve(client);
      });

      client.on('error', (err) => {
        clearTimeout(timer);
        this.logger.warn(`SSH error for ${config.id}: ${err.message}`);
        this.markDead(config.id, client);
        reject(err);
      });

      client.on('close', () => {
        this.markDead(config.id, client);
      });

      const connectConfig: Record<string, unknown> = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: CONNECT_TIMEOUT_MS,
        keepaliveInterval: 15_000,
        keepaliveCountMax: 3,
      };

      if (config.authType === 'key') {
        try {
          connectConfig['privateKey'] = readFileSync(config.keyPath);
          const passphrase = this.crypto.decrypt(config.passphraseEncrypted);
          if (passphrase) connectConfig['passphrase'] = passphrase;
        } catch (err: any) {
          clearTimeout(timer);
          reject(new Error(`Failed to read SSH key: ${err.message}`));
          return;
        }
      } else {
        connectConfig['password'] = this.crypto.decrypt(config.passwordEncrypted);
      }

      client.connect(connectConfig as any);
    });
  }

  private markDead(serverId: string, client: Client): void {
    const entries = this.pools.get(serverId);
    if (!entries) return;
    const entry = entries.find((e) => e.client === client);
    if (entry) entry.alive = false;
  }

  private healthCheck(): void {
    const now = Date.now();
    for (const [serverId, entries] of this.pools) {
      const remaining: PoolEntry[] = [];
      for (const entry of entries) {
        if (!entry.alive) {
          try { entry.client.end(); } catch { /* ignore */ }
          continue;
        }
        // Close idle connections
        if (entry.refCount === 0 && now - entry.lastUsed > IDLE_TIMEOUT_MS) {
          entry.alive = false;
          try { entry.client.end(); } catch { /* ignore */ }
          this.logger.debug(`Closed idle SSH connection for ${serverId}`);
          continue;
        }
        remaining.push(entry);
      }
      if (remaining.length === 0) {
        this.pools.delete(serverId);
      } else {
        this.pools.set(serverId, remaining);
      }
    }
  }
}
