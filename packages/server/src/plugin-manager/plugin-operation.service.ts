import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PluginRuntimeService } from './plugin-runtime.service.js';
import { FileManagerService } from '../file-manager/file-manager.service.js';
import { ServerConfigService } from '../server-process/server-config.service.js';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';

export enum PluginOperation {
  ENABLE = 'enable',
  DISABLE = 'disable',
  HOT_LOAD = 'hot-load',
  HOT_UNLOAD = 'hot-unload',
  HOT_RELOAD = 'hot-reload',
  REPLACE_VERSION = 'replace-version',
}

export interface PluginOperationResult {
  readonly success: boolean;
  readonly operation: PluginOperation;
  readonly pluginName: string;
  readonly serverId: string;
  readonly hasConnection: boolean;
  readonly message?: string;
  readonly requestId: string;
}

export interface ReplaceVersionOptions {
  readonly pluginName: string;
  readonly newJarData: Buffer;
  readonly newFilename: string;
  readonly hotSwap?: boolean; // If true, hot-unload → replace → hot-load
}

@Injectable()
export class PluginOperationService {
  private readonly logger = new Logger(PluginOperationService.name);

  constructor(
    private readonly runtimeService: PluginRuntimeService,
    private readonly fileManager: FileManagerService,
    private readonly configService: ServerConfigService,
  ) {}

  /**
   * Enable a plugin.
   * Hot track: loads the plugin via bridge console command if connected.
   * File track: ensures the .jar is present in plugins/ directory.
   */
  async enablePlugin(serverId: string, pluginName: string): Promise<PluginOperationResult> {
    const requestId = randomUUID();
    this.logger.log(`[${requestId}] Enable plugin "${pluginName}" on server ${serverId}`);

    // Verify plugin JAR exists
    await this.findPluginJar(serverId, pluginName);

    // Hot track: load via bridge
    const { sent, hasConnection } = await this.runtimeService.enable(serverId, pluginName);

    return {
      success: true,
      operation: PluginOperation.ENABLE,
      pluginName,
      serverId,
      hasConnection,
      message: hasConnection
        ? sent ? 'Plugin hot-loaded successfully' : 'Failed to send hot-load command'
        : 'Plugin will be enabled on next server start',
      requestId,
    };
  }

  /**
   * Disable a plugin.
   * Hot track: unloads the plugin via bridge console command if connected.
   * File track: no JAR deletion — just runtime disable.
   */
  async disablePlugin(serverId: string, pluginName: string): Promise<PluginOperationResult> {
    const requestId = randomUUID();
    this.logger.log(`[${requestId}] Disable plugin "${pluginName}" on server ${serverId}`);

    // Hot track: unload via bridge
    const { sent, hasConnection } = await this.runtimeService.disable(serverId, pluginName);

    return {
      success: true,
      operation: PluginOperation.DISABLE,
      pluginName,
      serverId,
      hasConnection,
      message: hasConnection
        ? sent ? 'Plugin hot-unloaded successfully' : 'Failed to send hot-unload command'
        : 'Plugin will be disabled on next server start',
      requestId,
    };
  }

  /**
   * Hot-load a plugin (bridge-only operation).
   * Requires an active bridge connection.
   */
  async hotLoadPlugin(serverId: string, pluginName: string): Promise<PluginOperationResult> {
    const requestId = randomUUID();
    this.logger.log(`[${requestId}] Hot-load plugin "${pluginName}" on server ${serverId}`);

    const sent = this.runtimeService.hotLoad(serverId, pluginName);

    return {
      success: sent,
      operation: PluginOperation.HOT_LOAD,
      pluginName,
      serverId,
      hasConnection: true,
      message: sent ? 'Hot-load command sent' : 'Failed to send hot-load command',
      requestId,
    };
  }

  /**
   * Hot-unload a plugin (bridge-only operation).
   * Requires an active bridge connection.
   */
  async hotUnloadPlugin(serverId: string, pluginName: string): Promise<PluginOperationResult> {
    const requestId = randomUUID();
    this.logger.log(`[${requestId}] Hot-unload plugin "${pluginName}" on server ${serverId}`);

    const sent = this.runtimeService.hotUnload(serverId, pluginName);

    return {
      success: sent,
      operation: PluginOperation.HOT_UNLOAD,
      pluginName,
      serverId,
      hasConnection: true,
      message: sent ? 'Hot-unload command sent' : 'Failed to send hot-unload command',
      requestId,
    };
  }

  /**
   * Hot-reload a plugin (bridge-only operation).
   * Requires an active bridge connection.
   */
  async hotReloadPlugin(serverId: string, pluginName: string): Promise<PluginOperationResult> {
    const requestId = randomUUID();
    this.logger.log(`[${requestId}] Hot-reload plugin "${pluginName}" on server ${serverId}`);

    const sent = this.runtimeService.hotReload(serverId, pluginName);

    return {
      success: sent,
      operation: PluginOperation.HOT_RELOAD,
      pluginName,
      serverId,
      hasConnection: true,
      message: sent ? 'Hot-reload command sent' : 'Failed to send hot-reload command',
      requestId,
    };
  }

  /**
   * Replace a plugin version (dual-track).
   * File track: deletes old JAR, uploads new JAR.
   * Hot track (optional): if hotSwap=true and bridge is connected, hot-unload → replace → hot-load.
   */
  async replacePluginVersion(
    serverId: string,
    options: ReplaceVersionOptions,
  ): Promise<PluginOperationResult> {
    const requestId = randomUUID();
    const { pluginName, newJarData, newFilename, hotSwap = true } = options;
    this.logger.log(
      `[${requestId}] Replace plugin "${pluginName}" version on server ${serverId} ` +
      `(hotSwap=${hotSwap}, file=${newFilename})`,
    );

    if (!newFilename.endsWith('.jar')) {
      throw new BadRequestException('Only .jar files are accepted for plugin replacement');
    }

    // Step 1: Find existing plugin JAR
    const existingJar = await this.findPluginJar(serverId, pluginName);

    // Step 2: Hot track — hot-unload if bridge connected and hotSwap requested
    let hotUnloaded = false;
    if (hotSwap && this.runtimeService.isConnected(serverId)) {
      hotUnloaded = this.runtimeService.hotUnload(serverId, pluginName);
      this.logger.log(`[${requestId}] Hot-unload sent: ${hotUnloaded}`);
    }

    // Step 3: File track — replace JAR
    // Delete old JAR
    await this.fileManager.deleteEntry(serverId, existingJar.path);
    this.logger.log(`[${requestId}] Deleted old JAR: ${existingJar.path}`);

    // Upload new JAR
    await this.fileManager.uploadFile(serverId, 'plugins', newJarData, newFilename);
    this.logger.log(`[${requestId}] Uploaded new JAR: plugins/${newFilename}`);

    // Step 4: Hot track — hot-load if bridge connected and hotSwap requested
    let hotLoaded = false;
    if (hotSwap && this.runtimeService.isConnected(serverId)) {
      hotLoaded = this.runtimeService.hotLoad(serverId, pluginName);
      this.logger.log(`[${requestId}] Hot-load sent: ${hotLoaded}`);
    }

    const hasConnection = this.runtimeService.isConnected(serverId);
    return {
      success: true,
      operation: PluginOperation.REPLACE_VERSION,
      pluginName,
      serverId,
      hasConnection,
      message: hasConnection && hotSwap
        ? `Replaced JAR and ${hotUnloaded && hotLoaded ? 'hot-swapped' : 'attempted hot-swap'} successfully`
        : `Replaced JAR. Plugin will load with new version on next server start`,
      requestId,
    };
  }

  /**
   * Find the .jar file for a plugin in the plugins/ directory.
   * Matches by filename containing the plugin name (case-insensitive).
   */
  private async findPluginJar(
    serverId: string,
    pluginName: string,
  ): Promise<{ name: string; path: string }> {
    const files = await this.fileManager.listDir(serverId, 'plugins');
    const jar = files.find(
      (f) =>
        !f.isDirectory &&
        f.name.endsWith('.jar') &&
        f.name.toLowerCase().includes(pluginName.toLowerCase()),
    );
    if (!jar) {
      throw new NotFoundException(`Plugin JAR not found for: ${pluginName}`);
    }
    return { name: jar.name, path: jar.path };
  }
}
