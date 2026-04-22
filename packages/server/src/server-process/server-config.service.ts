import { Injectable } from '@nestjs/common';
import { ConfigStoreService } from '../storage/config-store.service.js';
import type { ServerConfig, CreateServerConfigRequest, UpdateServerConfigRequest, SshConnectConfig } from '@jian-agent/shared-domain';

@Injectable()
export class ServerConfigService {
  constructor(private readonly store: ConfigStoreService) {}

  async getAll(): Promise<ServerConfig[]> {
    return this.store.findAll();
  }

  async getById(id: string): Promise<ServerConfig | undefined> {
    return this.store.findById(id);
  }

  async create(input: CreateServerConfigRequest): Promise<ServerConfig> {
    return this.store.create(input);
  }

  async update(id: string, input: UpdateServerConfigRequest): Promise<ServerConfig> {
    return this.store.update(id, input);
  }

  async delete(id: string): Promise<void> {
    return this.store.delete(id);
  }

  serverConfigToSshConfig(config: ServerConfig): SshConnectConfig {
    return {
      id: config.id,
      host: config.sshHost,
      port: config.sshPort,
      username: config.sshUsername,
      authType: config.sshAuthType,
      passwordEncrypted: config.sshPassword,
      keyPath: config.sshKeyPath,
      passphraseEncrypted: config.sshPassphrase,
      serverDir: config.serverDir || '/',
    };
  }
}
