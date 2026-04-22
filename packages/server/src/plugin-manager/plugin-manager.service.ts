import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import type { PluginMetadataDto } from '@jian-agent/shared-domain';
import { PluginBridgeService } from '../plugin-bridge/plugin-bridge.service.js';
import { PluginOperationService, PluginOperationResult, ReplaceVersionOptions } from './plugin-operation.service.js';
import { PluginRuntimeService, PluginRuntimeStatus } from './plugin-runtime.service.js';
import { JarPluginScanner } from './scanners/jar-plugin-scanner.js';
import { PluginStateResolver } from './plugin-state-resolver.js';
import { FileManagerService } from '../file-manager/file-manager.service.js';
import { SnapshotService } from '../plugin-bridge/snapshot.service.js';

@Injectable()
export class PluginManagerService {
  private readonly logger = new Logger(PluginManagerService.name);

  constructor(
    private readonly bridgeService: PluginBridgeService,
    private readonly operationService: PluginOperationService,
    private readonly runtimeService: PluginRuntimeService,
    private readonly scanner: JarPluginScanner,
    private readonly stateResolver: PluginStateResolver,
    private readonly fileManager: FileManagerService,
    private readonly snapshotService: SnapshotService,
  ) {}

  /**
   * List all plugins for a server with resolved install/runtime state.
   * Uses JarPluginScanner for disk discovery and PluginStateResolver
   * to merge disk state with probe runtime data.
   */
  async listPlugins(serverId: string): Promise<readonly PluginMetadataDto[]> {
    const diskEntries = await this.scanner.scan(serverId);
    return this.stateResolver.resolve(serverId, diskEntries);
  }

  /**
   * Upload a new plugin JAR to the plugins directory.
   */
  async uploadPlugin(serverId: string, data: Buffer, filename: string): Promise<void> {
    if (!filename.endsWith('.jar')) {
      throw new BadRequestException('Only .jar files can be uploaded as plugins');
    }
    await this.fileManager.uploadFile(serverId, 'plugins', data, filename);
    this.logger.log(`Plugin uploaded: ${filename} to server ${serverId}`);
  }

  /**
   * Delete a plugin JAR from the plugins directory.
   */
  async deletePlugin(serverId: string, pluginName: string): Promise<void> {
    const files = await this.fileManager.listDir(serverId, 'plugins');
    const jar = files.find(
      (f) =>
        !f.isDirectory &&
        f.name.toLowerCase().includes(pluginName.toLowerCase()) &&
        (f.name.endsWith('.jar') || f.name.endsWith('.jar.disabled')),
    );
    if (!jar) {
      throw new NotFoundException(`Plugin JAR not found for: ${pluginName}`);
    }
    await this.fileManager.deleteEntry(serverId, jar.path);
    this.logger.log(`Plugin deleted: ${jar.name} from server ${serverId}`);
  }

  /**
   * Enable a plugin (dual-track).
   * Delegates to PluginOperationService for unified hot + file operations.
   */
  enablePlugin(serverId: string, pluginName: string): Promise<PluginOperationResult> {
    return this.operationService.enablePlugin(serverId, pluginName);
  }

  /**
   * Disable a plugin (dual-track).
   * Delegates to PluginOperationService for unified hot + file operations.
   */
  disablePlugin(serverId: string, pluginName: string): Promise<PluginOperationResult> {
    return this.operationService.disablePlugin(serverId, pluginName);
  }

  /** Hot-load a plugin via bridge (requires active connection). */
  hotLoadPlugin(serverId: string, pluginName: string): Promise<PluginOperationResult> {
    return this.operationService.hotLoadPlugin(serverId, pluginName);
  }

  /** Hot-unload a plugin via bridge (requires active connection). */
  hotUnloadPlugin(serverId: string, pluginName: string): Promise<PluginOperationResult> {
    return this.operationService.hotUnloadPlugin(serverId, pluginName);
  }

  /** Hot-reload a plugin via bridge (requires active connection). */
  hotReloadPlugin(serverId: string, pluginName: string): Promise<PluginOperationResult> {
    return this.operationService.hotReloadPlugin(serverId, pluginName);
  }

  /** Replace a plugin JAR with a new version (dual-track: file + optional hot-swap). */
  replacePluginVersion(
    serverId: string,
    pluginName: string,
    newJarData: Buffer,
    newFilename: string,
    hotSwap = true,
  ): Promise<PluginOperationResult> {
    return this.operationService.replacePluginVersion(serverId, {
      pluginName,
      newJarData,
      newFilename,
      hotSwap,
    });
  }

  /** Get runtime status of a single plugin. */
  getPluginRuntimeStatus(serverId: string, pluginName: string): PluginRuntimeStatus | undefined {
    return this.runtimeService.getPluginStatus(serverId, pluginName);
  }

  /** Check if server has active bridge connection. */
  hasPluginBridge(serverId: string): boolean {
    return this.runtimeService.isConnected(serverId);
  }
}
