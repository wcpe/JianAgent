import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { readFileSync } from 'node:fs';
import { Client } from 'ssh2';
import { remoteHosts } from '../storage/schema.js';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../storage/drizzle.provider.js';
import { SshCryptoService } from '../ssh/ssh-crypto.service.js';
import type {
  RemoteHostDto,
  CreateRemoteHostRequest,
  UpdateRemoteHostRequest,
  SshConnectConfig,
} from '@jian-agent/shared-domain';

interface RemoteHostRow {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: string;
  passwordEncrypted: string;
  keyPath: string;
  passphraseEncrypted: string;
  tags: string;
  description: string;
  status: string;
  lastConnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const CONNECT_TIMEOUT_MS = 10_000;

@Injectable()
export class RemoteHostService {
  private readonly logger = new Logger(RemoteHostService.name);

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
    private readonly crypto: SshCryptoService,
  ) {}

  private rowToDto(row: RemoteHostRow): RemoteHostDto {
    return {
      id: row.id,
      name: row.name,
      host: row.host,
      port: row.port,
      username: row.username,
      authType: row.authType as 'password' | 'key',
      tags: JSON.parse(row.tags) as string[],
      description: row.description,
      status: row.status,
      lastConnectedAt: row.lastConnectedAt,
      hasPassword: Boolean(row.passwordEncrypted),
      hasPassphrase: Boolean(row.passphraseEncrypted),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  toSshConfig(row: RemoteHostRow): SshConnectConfig {
    return {
      id: row.id,
      host: row.host,
      port: row.port,
      username: row.username,
      authType: row.authType as 'password' | 'key',
      passwordEncrypted: row.passwordEncrypted,
      keyPath: row.keyPath,
      passphraseEncrypted: row.passphraseEncrypted,
    };
  }

  async list(): Promise<RemoteHostDto[]> {
    const rows = await this.db.select().from(remoteHosts);
    return (rows as RemoteHostRow[]).map((row) => this.rowToDto(row));
  }

  async getByIdDto(id: string): Promise<RemoteHostDto> {
    const row = await this.getById(id);
    return this.rowToDto(row);
  }

  async getById(id: string): Promise<RemoteHostRow> {
    const [row] = await this.db
      .select()
      .from(remoteHosts)
      .where(eq(remoteHosts.id, id));
    if (!row) throw new NotFoundException(`Remote host ${id} not found`);
    return row as RemoteHostRow;
  }

  async create(req: CreateRemoteHostRequest): Promise<RemoteHostDto> {
    const now = new Date().toISOString();
    const id = `host_${randomUUID().slice(0, 12)}`;
    const passwordEncrypted = req.password
      ? this.crypto.encrypt(req.password)
      : '';
    const passphraseEncrypted = req.passphrase
      ? this.crypto.encrypt(req.passphrase)
      : '';

    const [row] = await this.db
      .insert(remoteHosts)
      .values({
        id,
        name: req.name,
        host: req.host,
        port: req.port ?? 22,
        username: req.username,
        authType: req.authType,
        passwordEncrypted,
        keyPath: req.keyPath ?? '',
        passphraseEncrypted,
        tags: JSON.stringify(req.tags ?? []),
        description: req.description ?? '',
        status: 'unknown',
        lastConnectedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return this.rowToDto(row as RemoteHostRow);
  }

  async update(id: string, req: UpdateRemoteHostRequest): Promise<RemoteHostDto> {
    const existing = await this.getById(id);

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (req.name !== undefined) updates['name'] = req.name;
    if (req.host !== undefined) updates['host'] = req.host;
    if (req.port !== undefined) updates['port'] = req.port;
    if (req.username !== undefined) updates['username'] = req.username;
    if (req.authType !== undefined) updates['authType'] = req.authType;
    if (req.keyPath !== undefined) updates['keyPath'] = req.keyPath;
    if (req.tags !== undefined) updates['tags'] = JSON.stringify(req.tags);
    if (req.description !== undefined) updates['description'] = req.description;
    if (req.password !== undefined) {
      updates['passwordEncrypted'] = this.crypto.encrypt(req.password);
    }
    if (req.passphrase !== undefined) {
      updates['passphraseEncrypted'] = this.crypto.encrypt(req.passphrase);
    }

    await this.db
      .update(remoteHosts)
      .set(updates)
      .where(eq(remoteHosts.id, id));

    const [updated] = await this.db
      .select()
      .from(remoteHosts)
      .where(eq(remoteHosts.id, id));
    return this.rowToDto(updated as RemoteHostRow);
  }

  async delete(id: string): Promise<void> {
    await this.getById(id); // ensure exists
    await this.db.delete(remoteHosts).where(eq(remoteHosts.id, id));
  }

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    const row = await this.getById(id);
    const config = this.toSshConfig(row);
    return this.testConnectionWithConfig(config, {
      host: row.host,
      port: row.port,
      username: row.username,
      onSuccess: async () => this.updateHostStatus(id, 'online'),
      onError: async () => this.updateHostStatus(id, 'error'),
    });
  }

  async testConnectionPreview(
    req: CreateRemoteHostRequest | UpdateRemoteHostRequest,
  ): Promise<{ success: boolean; message: string }> {
    const authType = req.authType ?? 'password';
    const config: SshConnectConfig = {
      id: 'preview',
      host: req.host ?? '',
      port: req.port ?? 22,
      username: req.username ?? '',
      authType,
      passwordEncrypted: req.password ? this.crypto.encrypt(req.password) : '',
      keyPath: req.keyPath ?? '',
      passphraseEncrypted: req.passphrase
        ? this.crypto.encrypt(req.passphrase)
        : '',
    };

    return this.testConnectionWithConfig(config, {
      host: config.host,
      port: config.port,
      username: config.username,
    });
  }

  private testConnectionWithConfig(
    config: SshConnectConfig,
    opts: {
      host: string;
      port: number;
      username: string;
      onSuccess?: () => Promise<void> | void;
      onError?: () => Promise<void> | void;
    },
  ): Promise<{ success: boolean; message: string }> {
    return new Promise<{ success: boolean; message: string }>((resolve) => {
      const client = new Client();
      const timer = setTimeout(() => {
        client.end();
        void opts.onError?.();
        resolve({ success: false, message: `Connection timed out after ${CONNECT_TIMEOUT_MS}ms` });
      }, CONNECT_TIMEOUT_MS);

      client.on('ready', () => {
        clearTimeout(timer);
        this.logger.log(`SSH test OK: ${opts.host}:${opts.port}`);
        void opts.onSuccess?.();
        client.end();
        resolve({ success: true, message: `Connected to ${opts.host}:${opts.port} as ${opts.username}` });
      });

      client.on('error', (err: Error) => {
        clearTimeout(timer);
        this.logger.warn(`SSH test failed for ${opts.host}:${opts.port}: ${err.message}`);
        void opts.onError?.();
        resolve({ success: false, message: err.message });
      });

      const connectConfig: Record<string, unknown> = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: CONNECT_TIMEOUT_MS,
      };

      if (config.authType === 'key') {
        try {
          connectConfig['privateKey'] = readFileSync(config.keyPath);
          const passphrase = this.crypto.decrypt(config.passphraseEncrypted);
          if (passphrase) connectConfig['passphrase'] = passphrase;
        } catch (err: any) {
          clearTimeout(timer);
          resolve({ success: false, message: `Failed to read SSH key: ${err.message}` });
          return;
        }
      } else {
        connectConfig['password'] = this.crypto.decrypt(config.passwordEncrypted);
      }

      client.connect(connectConfig as any);
    });
  }

  private async updateHostStatus(id: string, status: string): Promise<void> {
    try {
      const updates: Record<string, unknown> = {
        status,
        updatedAt: new Date().toISOString(),
      };
      if (status === 'online') {
        updates['lastConnectedAt'] = new Date().toISOString();
      }
      await this.db
        .update(remoteHosts)
        .set(updates)
        .where(eq(remoteHosts.id, id));
    } catch (err) {
      this.logger.warn(`Failed to update host status: ${err}`);
    }
  }
}
