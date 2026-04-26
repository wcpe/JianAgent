import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { DrizzleDb } from './drizzle.provider.js';
import { DRIZZLE_TOKEN } from './drizzle.provider.js';
import { serverConfigs } from './schema.js';
import type { ServerConfig, CreateServerConfigRequest, UpdateServerConfigRequest } from '@jian-agent/shared-domain';
import { DEFAULTS } from '@jian-agent/shared-domain';

@Injectable()
export class ConfigStoreService {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  async create(input: CreateServerConfigRequest): Promise<ServerConfig> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const serverType = input.serverType ?? 'managed';
    const row = {
      id,
      name: input.name,
      serverType,
      javaPath: input.javaPath ?? '',
      jarPath: input.jarPath ?? '',
      workDir: input.workDir ?? '',
      jvmArgs: JSON.stringify(input.jvmArgs?.length ? input.jvmArgs : DEFAULTS.JVM_ARGS),
      serverArgs: JSON.stringify(input.serverArgs?.length ? input.serverArgs : DEFAULTS.SERVER_ARGS),
      envVars: JSON.stringify(input.envVars ?? {}),
      encoding: input.encoding ?? DEFAULTS.SERVER_ENCODING,
      autoRestart: input.autoRestart ?? DEFAULTS.SERVER_AUTO_RESTART,
      maxRestarts: input.maxRestarts ?? DEFAULTS.SERVER_MAX_RESTARTS,
      host: input.host ?? DEFAULTS.SERVER_HOST,
      port: input.port ?? DEFAULTS.SERVER_PORT,
      sshHost: input.sshHost ?? '',
      sshPort: input.sshPort ?? 22,
      sshUsername: input.sshUsername ?? '',
      sshAuthType: input.sshAuthType ?? 'password',
      sshPassword: input.sshPassword ?? '',
      sshKeyPath: input.sshKeyPath ?? '',
      sshPassphrase: input.sshPassphrase ?? '',
      serverDir: input.serverDir ?? '',
      logsPath: input.logsPath ?? 'logs',
      runtimeId: input.runtimeId ?? '',
      probeVersion: '',
      preStartCommand: input.preStartCommand ?? '',
      postStartCommand: input.postStartCommand ?? '',
      preStopCommand: input.preStopCommand ?? '',
      postStopCommand: input.postStopCommand ?? '',
      scriptTimeoutMs: input.scriptTimeoutMs ?? DEFAULTS.SCRIPT_TIMEOUT_MS,
      readyPattern: input.readyPattern ?? '',
      readyTimeoutMs: input.readyTimeoutMs ?? 120000,
      serverGroup: input.serverGroup ?? '',
      tags: JSON.stringify(input.tags ?? []),
      description: input.description ?? '',
      createdAt: now,
      updatedAt: now,
    };
    this.db.insert(serverConfigs).values(row).run();
    return this.toDto(row);
  }

  async findById(id: string): Promise<ServerConfig | undefined> {
    const rows = this.db.select().from(serverConfigs).where(eq(serverConfigs.id, id)).all();
    return rows[0] ? this.toDto(rows[0]) : undefined;
  }

  async findAll(): Promise<ServerConfig[]> {
    const rows = this.db.select().from(serverConfigs).all();
    return rows.map((r) => this.toDto(r));
  }

  async update(id: string, input: UpdateServerConfigRequest): Promise<ServerConfig> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Config not found: ${id}`);

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updatedAt: now };
    if (input.serverType !== undefined) updates['serverType'] = input.serverType;
    if (input.name !== undefined) updates['name'] = input.name;
    if (input.javaPath !== undefined) updates['javaPath'] = input.javaPath;
    if (input.jarPath !== undefined) updates['jarPath'] = input.jarPath;
    if (input.workDir !== undefined) updates['workDir'] = input.workDir;
    if (input.jvmArgs !== undefined) updates['jvmArgs'] = JSON.stringify(input.jvmArgs);
    if (input.serverArgs !== undefined) updates['serverArgs'] = JSON.stringify(input.serverArgs);
    if (input.envVars !== undefined) updates['envVars'] = JSON.stringify(input.envVars);
    if (input.encoding !== undefined) updates['encoding'] = input.encoding;
    if (input.autoRestart !== undefined) updates['autoRestart'] = input.autoRestart;
    if (input.maxRestarts !== undefined) updates['maxRestarts'] = input.maxRestarts;
    if (input.host !== undefined) updates['host'] = input.host;
    if (input.port !== undefined) updates['port'] = input.port;
    if (input.sshHost !== undefined) updates['sshHost'] = input.sshHost;
    if (input.sshPort !== undefined) updates['sshPort'] = input.sshPort;
    if (input.sshUsername !== undefined) updates['sshUsername'] = input.sshUsername;
    if (input.sshAuthType !== undefined) updates['sshAuthType'] = input.sshAuthType;
    if (input.sshPassword !== undefined) updates['sshPassword'] = input.sshPassword;
    if (input.sshKeyPath !== undefined) updates['sshKeyPath'] = input.sshKeyPath;
    if (input.sshPassphrase !== undefined) updates['sshPassphrase'] = input.sshPassphrase;
    if (input.serverDir !== undefined) updates['serverDir'] = input.serverDir;
    if (input.logsPath !== undefined) updates['logsPath'] = input.logsPath;
    if (input.runtimeId !== undefined) updates['runtimeId'] = input.runtimeId;
    if (input.preStartCommand !== undefined) updates['preStartCommand'] = input.preStartCommand;
    if (input.postStartCommand !== undefined) updates['postStartCommand'] = input.postStartCommand;
    if (input.preStopCommand !== undefined) updates['preStopCommand'] = input.preStopCommand;
    if (input.postStopCommand !== undefined) updates['postStopCommand'] = input.postStopCommand;
    if (input.scriptTimeoutMs !== undefined) updates['scriptTimeoutMs'] = input.scriptTimeoutMs;
    if (input.readyPattern !== undefined) updates['readyPattern'] = input.readyPattern;
    if (input.readyTimeoutMs !== undefined) updates['readyTimeoutMs'] = input.readyTimeoutMs;
    if (input.serverGroup !== undefined) updates['serverGroup'] = input.serverGroup;
    if (input.tags !== undefined) updates['tags'] = JSON.stringify(input.tags);
    if (input.description !== undefined) updates['description'] = input.description;

    this.db.update(serverConfigs).set(updates).where(eq(serverConfigs.id, id)).run();
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    this.db.delete(serverConfigs).where(eq(serverConfigs.id, id)).run();
  }

  private toDto(row: typeof serverConfigs.$inferSelect): ServerConfig {
    return {
      id: row.id,
      name: row.name,
      serverType: (row.serverType as ServerConfig['serverType']) ?? 'managed',
      javaPath: row.javaPath,
      jarPath: row.jarPath,
      workDir: row.workDir,
      jvmArgs: JSON.parse(row.jvmArgs),
      serverArgs: JSON.parse(row.serverArgs),
      envVars: JSON.parse(row.envVars),
      encoding: row.encoding,
      autoRestart: row.autoRestart,
      maxRestarts: row.maxRestarts,
      host: row.host,
      port: row.port,
      sshHost: row.sshHost,
      sshPort: row.sshPort,
      sshUsername: row.sshUsername,
      sshAuthType: (row.sshAuthType as ServerConfig['sshAuthType']) ?? 'password',
      sshPassword: row.sshPassword,
      sshKeyPath: row.sshKeyPath,
      sshPassphrase: row.sshPassphrase,
      serverDir: row.serverDir,
      logsPath: row.logsPath,
      runtimeId: row.runtimeId,
      probeVersion: row.probeVersion,
      preStartCommand: row.preStartCommand,
      postStartCommand: row.postStartCommand,
      preStopCommand: row.preStopCommand,
      postStopCommand: row.postStopCommand,
      scriptTimeoutMs: row.scriptTimeoutMs,
      readyPattern: row.readyPattern,
      readyTimeoutMs: row.readyTimeoutMs,
      serverGroup: row.serverGroup,
      tags: JSON.parse(row.tags),
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
