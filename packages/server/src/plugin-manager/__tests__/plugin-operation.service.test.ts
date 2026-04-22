import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginOperationService, PluginOperation } from '../plugin-operation.service.js';
import type { PluginRuntimeService } from '../plugin-runtime.service.js';
import type { FileManagerService } from '../../file-manager/file-manager.service.js';
import type { ServerConfigService } from '../../server-process/server-config.service.js';
import { NotFoundException, BadRequestException } from '@nestjs/common';

function createMockPluginRuntimeService(): PluginRuntimeService {
  return {
    isConnected: vi.fn(),
    hotLoad: vi.fn(),
    hotUnload: vi.fn(),
    hotReload: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
  } as unknown as PluginRuntimeService;
}

function createMockFileManagerService(): FileManagerService {
  return {
    listDir: vi.fn(),
    uploadFile: vi.fn(),
    deleteEntry: vi.fn(),
  } as unknown as FileManagerService;
}

function createMockServerConfigService(): ServerConfigService {
  return {} as unknown as ServerConfigService;
}

describe('PluginOperationService', () => {
  let service: PluginOperationService;
  let runtimeService: PluginRuntimeService;
  let fileManager: FileManagerService;
  let configService: ServerConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    runtimeService = createMockPluginRuntimeService();
    fileManager = createMockFileManagerService();
    configService = createMockServerConfigService();
    service = new PluginOperationService(runtimeService, fileManager, configService);
  });

  describe('enablePlugin', () => {
    it('should enable plugin with bridge connection', async () => {
      // Mock findPluginJar to succeed
      (fileManager.listDir as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: 'TestPlugin.jar', isDirectory: false, path: 'plugins/TestPlugin.jar' },
      ]);

      // Mock runtime service
      (runtimeService.enable as ReturnType<typeof vi.fn>).mockResolvedValue({
        sent: true,
        hasConnection: true,
      });

      const result = await service.enablePlugin('server1', 'TestPlugin');

      expect(result.success).toBe(true);
      expect(result.operation).toBe(PluginOperation.ENABLE);
      expect(result.pluginName).toBe('TestPlugin');
      expect(result.serverId).toBe('server1');
      expect(result.hasConnection).toBe(true);
      expect(result.message).toBe('Plugin hot-loaded successfully');
      expect(result.requestId).toBeDefined();
    });

    it('should enable plugin without bridge connection', async () => {
      (fileManager.listDir as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: 'TestPlugin.jar', isDirectory: false, path: 'plugins/TestPlugin.jar' },
      ]);

      (runtimeService.enable as ReturnType<typeof vi.fn>).mockResolvedValue({
        sent: false,
        hasConnection: false,
      });

      const result = await service.enablePlugin('server1', 'TestPlugin');

      expect(result.success).toBe(true);
      expect(result.hasConnection).toBe(false);
      expect(result.message).toBe('Plugin will be enabled on next server start');
    });

    it('should throw NotFoundException when plugin JAR not found', async () => {
      (fileManager.listDir as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: 'OtherPlugin.jar', isDirectory: false, path: 'plugins/OtherPlugin.jar' },
      ]);

      await expect(service.enablePlugin('server1', 'MissingPlugin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('disablePlugin', () => {
    it('should disable plugin with bridge connection', async () => {
      (runtimeService.disable as ReturnType<typeof vi.fn>).mockResolvedValue({
        sent: true,
        hasConnection: true,
      });

      const result = await service.disablePlugin('server1', 'TestPlugin');

      expect(result.success).toBe(true);
      expect(result.operation).toBe(PluginOperation.DISABLE);
      expect(result.hasConnection).toBe(true);
      expect(result.message).toBe('Plugin hot-unloaded successfully');
    });

    it('should disable plugin without bridge connection', async () => {
      (runtimeService.disable as ReturnType<typeof vi.fn>).mockResolvedValue({
        sent: false,
        hasConnection: false,
      });

      const result = await service.disablePlugin('server1', 'TestPlugin');

      expect(result.success).toBe(true);
      expect(result.hasConnection).toBe(false);
      expect(result.message).toBe('Plugin will be disabled on next server start');
    });
  });

  describe('hotLoadPlugin', () => {
    it('should hot-load plugin successfully', async () => {
      (runtimeService.hotLoad as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const result = await service.hotLoadPlugin('server1', 'TestPlugin');

      expect(result.success).toBe(true);
      expect(result.operation).toBe(PluginOperation.HOT_LOAD);
      expect(result.hasConnection).toBe(true);
      expect(result.message).toBe('Hot-load command sent');
    });

    it('should handle hot-load failure', async () => {
      (runtimeService.hotLoad as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const result = await service.hotLoadPlugin('server1', 'TestPlugin');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to send hot-load command');
    });
  });

  describe('hotUnloadPlugin', () => {
    it('should hot-unload plugin successfully', async () => {
      (runtimeService.hotUnload as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const result = await service.hotUnloadPlugin('server1', 'TestPlugin');

      expect(result.success).toBe(true);
      expect(result.operation).toBe(PluginOperation.HOT_UNLOAD);
      expect(result.message).toBe('Hot-unload command sent');
    });

    it('should handle hot-unload failure', async () => {
      (runtimeService.hotUnload as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const result = await service.hotUnloadPlugin('server1', 'TestPlugin');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to send hot-unload command');
    });
  });

  describe('hotReloadPlugin', () => {
    it('should hot-reload plugin successfully', async () => {
      (runtimeService.hotReload as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const result = await service.hotReloadPlugin('server1', 'TestPlugin');

      expect(result.success).toBe(true);
      expect(result.operation).toBe(PluginOperation.HOT_RELOAD);
      expect(result.message).toBe('Hot-reload command sent');
    });

    it('should handle hot-reload failure', async () => {
      (runtimeService.hotReload as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const result = await service.hotReloadPlugin('server1', 'TestPlugin');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to send hot-reload command');
    });
  });

  describe('replacePluginVersion', () => {
    it('should replace plugin version with hot-swap', async () => {
      // Mock findPluginJar
      (fileManager.listDir as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: 'TestPlugin-1.0.jar', isDirectory: false, path: 'plugins/TestPlugin-1.0.jar' },
      ]);

      // Mock runtime service
      (runtimeService.isConnected as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (runtimeService.hotUnload as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (runtimeService.hotLoad as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const newJarData = Buffer.from('new jar content');
      const result = await service.replacePluginVersion('server1', {
        pluginName: 'TestPlugin',
        newJarData,
        newFilename: 'TestPlugin-2.0.jar',
        hotSwap: true,
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe(PluginOperation.REPLACE_VERSION);
      expect(result.hasConnection).toBe(true);
      expect(result.message).toContain('hot-swapped');

      // Verify file operations
      expect(fileManager.deleteEntry).toHaveBeenCalledWith(
        'server1',
        'plugins/TestPlugin-1.0.jar',
      );
      expect(fileManager.uploadFile).toHaveBeenCalledWith(
        'server1',
        'plugins',
        newJarData,
        'TestPlugin-2.0.jar',
      );
    });

    it('should replace plugin version without hot-swap', async () => {
      (fileManager.listDir as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: 'TestPlugin-1.0.jar', isDirectory: false, path: 'plugins/TestPlugin-1.0.jar' },
      ]);

      (runtimeService.isConnected as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const newJarData = Buffer.from('new jar content');
      const result = await service.replacePluginVersion('server1', {
        pluginName: 'TestPlugin',
        newJarData,
        newFilename: 'TestPlugin-2.0.jar',
        hotSwap: false,
      });

      expect(result.success).toBe(true);
      expect(result.hasConnection).toBe(true);
      expect(result.message).toContain('Plugin will load with new version on next server start');

      // Verify hot operations were not called
      expect(runtimeService.hotUnload).not.toHaveBeenCalled();
      expect(runtimeService.hotLoad).not.toHaveBeenCalled();
    });

    it('should replace plugin version without bridge connection', async () => {
      (fileManager.listDir as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: 'TestPlugin-1.0.jar', isDirectory: false, path: 'plugins/TestPlugin-1.0.jar' },
      ]);

      (runtimeService.isConnected as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const newJarData = Buffer.from('new jar content');
      const result = await service.replacePluginVersion('server1', {
        pluginName: 'TestPlugin',
        newJarData,
        newFilename: 'TestPlugin-2.0.jar',
        hotSwap: true,
      });

      expect(result.success).toBe(true);
      expect(result.hasConnection).toBe(false);
      expect(result.message).toContain('Plugin will load with new version on next server start');

      // Verify hot operations were not called
      expect(runtimeService.hotUnload).not.toHaveBeenCalled();
      expect(runtimeService.hotLoad).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for non-jar files', async () => {
      await expect(
        service.replacePluginVersion('server1', {
          pluginName: 'TestPlugin',
          newJarData: Buffer.from('content'),
          newFilename: 'TestPlugin.zip',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when existing plugin JAR not found', async () => {
      (fileManager.listDir as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: 'OtherPlugin.jar', isDirectory: false, path: 'plugins/OtherPlugin.jar' },
      ]);

      await expect(
        service.replacePluginVersion('server1', {
          pluginName: 'MissingPlugin',
          newJarData: Buffer.from('content'),
          newFilename: 'MissingPlugin-2.0.jar',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle partial hot-swap failure', async () => {
      (fileManager.listDir as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: 'TestPlugin-1.0.jar', isDirectory: false, path: 'plugins/TestPlugin-1.0.jar' },
      ]);

      (runtimeService.isConnected as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (runtimeService.hotUnload as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (runtimeService.hotLoad as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const newJarData = Buffer.from('new jar content');
      const result = await service.replacePluginVersion('server1', {
        pluginName: 'TestPlugin',
        newJarData,
        newFilename: 'TestPlugin-2.0.jar',
        hotSwap: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('attempted hot-swap');
    });
  });
});