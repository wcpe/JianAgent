import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JarPluginScanner } from '../scanners/jar-plugin-scanner.js';
import type { FileManagerService } from '../../file-manager/file-manager.service.js';
import type { ServerConfigService } from '../../server-process/server-config.service.js';
import { PluginInstallState } from '@jian-agent/shared-domain';

// Mock AdmZip and js-yaml
vi.mock('adm-zip', () => ({
  default: vi.fn().mockImplementation(() => ({
    getEntry: vi.fn(),
  })),
}));

vi.mock('js-yaml', () => ({
  default: {
    load: vi.fn(),
  },
}));

function createMockFileManagerService(): FileManagerService {
  return {
    listDir: vi.fn(),
    downloadFile: vi.fn(),
    uploadFile: vi.fn(),
    deleteEntry: vi.fn(),
    mkdir: vi.fn(),
    rename: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
  } as unknown as FileManagerService;
}

function createMockServerConfigService(): ServerConfigService {
  return {
    getConfig: vi.fn(),
    requireConfig: vi.fn(),
  } as unknown as ServerConfigService;
}

describe('JarPluginScanner', () => {
  let scanner: JarPluginScanner;
  let fileManager: FileManagerService;
  let configService: ServerConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    fileManager = createMockFileManagerService();
    configService = createMockServerConfigService();
    scanner = new JarPluginScanner(fileManager, configService);
  });

  describe('scan', () => {
    it('should return empty array when plugins directory listing fails', async () => {
      // Mock listDir to throw an error
      (fileManager.listDir as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Directory not found'),
      );

      const result = await scanner.scan('server1');

      expect(result).toEqual([]);
      expect(fileManager.listDir).toHaveBeenCalledWith('server1', 'plugins');
    });

    it('should return empty array when no jar files exist', async () => {
      // Mock empty directory listing
      (fileManager.listDir as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await scanner.scan('server1');

      expect(result).toEqual([]);
    });

    it('should filter out non-jar files', async () => {
      const mockFiles = [
        { name: 'config.yml', isDirectory: false, path: 'plugins/config.yml' },
        { name: 'MyPlugin.jar', isDirectory: false, path: 'plugins/MyPlugin.jar' },
        { name: 'SubFolder', isDirectory: true, path: 'plugins/SubFolder' },
      ];

      (fileManager.listDir as ReturnType<typeof vi.fn>).mockResolvedValue(mockFiles);
      (fileManager.downloadFile as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Cannot read JAR'),
      );

      const result = await scanner.scan('server1');

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('MyPlugin.jar');
    });

    it('should handle .jar.disabled files correctly', async () => {
      const mockFiles = [
        { name: 'DisabledPlugin.jar.disabled', isDirectory: false, path: 'plugins/DisabledPlugin.jar.disabled' },
      ];

      (fileManager.listDir as ReturnType<typeof vi.fn>).mockResolvedValue(mockFiles);
      (fileManager.downloadFile as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Cannot read JAR'),
      );

      const result = await scanner.scan('server1');

      expect(result).toHaveLength(1);
      expect(result[0].disabledOnDisk).toBe(true);
      expect(result[0].installState).toBe(PluginInstallState.DISABLED);
      expect(result[0].key).toBe('disabledplugin');
    });

    it('should use filename stem when descriptor is missing', async () => {
      const mockFiles = [
        { name: 'MyAwesomePlugin.jar', isDirectory: false, path: 'plugins/MyAwesomePlugin.jar' },
      ];

      (fileManager.listDir as ReturnType<typeof vi.fn>).mockResolvedValue(mockFiles);
      (fileManager.downloadFile as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Cannot read JAR'),
      );

      const result = await scanner.scan('server1');

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('myawesomeplugin');
      expect(result[0].descriptor).toBeNull();
      expect(result[0].installState).toBe(PluginInstallState.INSTALLED);
    });

    it('should parse plugin.yml from JAR', async () => {
      const AdmZip = await import('adm-zip');
      const yaml = await import('js-yaml');

      const mockFiles = [
        { name: 'TestPlugin.jar', isDirectory: false, path: 'plugins/TestPlugin.jar' },
      ];

      const mockYamlContent = `
name: TestPlugin
version: 1.0.0
author: TestAuthor
description: A test plugin
main: com.example.TestPlugin
api-version: 1.20
depend: [Vault]
softdepend: [PlaceholderAPI]
website: https://example.com
`;

      const mockEntry = {
        getData: vi.fn().mockReturnValue(Buffer.from(mockYamlContent)),
      };

      const mockZip = {
        getEntry: vi.fn().mockReturnValue(mockEntry),
      };

      (AdmZip.default as ReturnType<typeof vi.fn>).mockImplementation(() => mockZip);
      (yaml.default.load as ReturnType<typeof vi.fn>).mockReturnValue({
        name: 'TestPlugin',
        version: '1.0.0',
        author: 'TestAuthor',
        description: 'A test plugin',
        main: 'com.example.TestPlugin',
        'api-version': '1.20',
        depend: ['Vault'],
        softdepend: ['PlaceholderAPI'],
        website: 'https://example.com',
      });

      (fileManager.listDir as ReturnType<typeof vi.fn>).mockResolvedValue(mockFiles);
      (fileManager.downloadFile as ReturnType<typeof vi.fn>).mockResolvedValue(
        Buffer.from('mock jar content'),
      );

      const result = await scanner.scan('server1');

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('testplugin');
      expect(result[0].descriptor).not.toBeNull();
      expect(result[0].descriptor!.name).toBe('TestPlugin');
      expect(result[0].descriptor!.version).toBe('1.0.0');
      expect(result[0].descriptor!.authors).toEqual(['TestAuthor']);
      expect(result[0].descriptor!.description).toBe('A test plugin');
      expect(result[0].descriptor!.main).toBe('com.example.TestPlugin');
      expect(result[0].descriptor!.apiVersion).toBe('1.20');
      expect(result[0].descriptor!.depend).toEqual(['Vault']);
      expect(result[0].descriptor!.softDepend).toEqual(['PlaceholderAPI']);
      expect(result[0].descriptor!.website).toBe('https://example.com');
    });

    it('should handle multiple authors in plugin.yml', async () => {
      const AdmZip = await import('adm-zip');
      const yaml = await import('js-yaml');

      const mockFiles = [
        { name: 'MultiAuthor.jar', isDirectory: false, path: 'plugins/MultiAuthor.jar' },
      ];

      const mockEntry = {
        getData: vi.fn().mockReturnValue(Buffer.from('mock yaml')),
      };

      const mockZip = {
        getEntry: vi.fn().mockReturnValue(mockEntry),
      };

      (AdmZip.default as ReturnType<typeof vi.fn>).mockImplementation(() => mockZip);
      (yaml.default.load as ReturnType<typeof vi.fn>).mockReturnValue({
        name: 'MultiAuthorPlugin',
        version: '2.0.0',
        authors: ['Author1', 'Author2'],
      });

      (fileManager.listDir as ReturnType<typeof vi.fn>).mockResolvedValue(mockFiles);
      (fileManager.downloadFile as ReturnType<typeof vi.fn>).mockResolvedValue(
        Buffer.from('mock jar content'),
      );

      const result = await scanner.scan('server1');

      expect(result).toHaveLength(1);
      expect(result[0].descriptor!.authors).toEqual(['Author1', 'Author2']);
    });

    it('should handle paper-plugin.yml fallback', async () => {
      const AdmZip = await import('adm-zip');
      const yaml = await import('js-yaml');

      const mockFiles = [
        { name: 'PaperPlugin.jar', isDirectory: false, path: 'plugins/PaperPlugin.jar' },
      ];

      const mockZip = {
        getEntry: vi.fn().mockImplementation((filename: string) => {
          if (filename === 'plugin.yml') return null;
          if (filename === 'paper-plugin.yml') {
            return {
              getData: vi.fn().mockReturnValue(Buffer.from('mock yaml')),
            };
          }
          return null;
        }),
      };

      (AdmZip.default as ReturnType<typeof vi.fn>).mockImplementation(() => mockZip);
      (yaml.default.load as ReturnType<typeof vi.fn>).mockReturnValue({
        name: 'PaperPlugin',
        version: '1.0.0',
        author: 'PaperAuthor',
      });

      (fileManager.listDir as ReturnType<typeof vi.fn>).mockResolvedValue(mockFiles);
      (fileManager.downloadFile as ReturnType<typeof vi.fn>).mockResolvedValue(
        Buffer.from('mock jar content'),
      );

      const result = await scanner.scan('server1');

      expect(result).toHaveLength(1);
      expect(result[0].descriptor!.name).toBe('PaperPlugin');
    });

    it('should handle malformed YAML gracefully', async () => {
      const AdmZip = await import('adm-zip');
      const yaml = await import('js-yaml');

      const mockFiles = [
        { name: 'BadYaml.jar', isDirectory: false, path: 'plugins/BadYaml.jar' },
      ];

      const mockEntry = {
        getData: vi.fn().mockReturnValue(Buffer.from('invalid: yaml: content:')),
      };

      const mockZip = {
        getEntry: vi.fn().mockReturnValue(mockEntry),
      };

      (AdmZip.default as ReturnType<typeof vi.fn>).mockImplementation(() => mockZip);
      (yaml.default.load as ReturnType<typeof vi.fn>).mockReturnValue(null);

      (fileManager.listDir as ReturnType<typeof vi.fn>).mockResolvedValue(mockFiles);
      (fileManager.downloadFile as ReturnType<typeof vi.fn>).mockResolvedValue(
        Buffer.from('mock jar content'),
      );

      const result = await scanner.scan('server1');

      expect(result).toHaveLength(1);
      expect(result[0].descriptor).toBeNull();
    });

    it('should process multiple JAR files', async () => {
      const mockFiles = [
        { name: 'Plugin1.jar', isDirectory: false, path: 'plugins/Plugin1.jar' },
        { name: 'Plugin2.jar.disabled', isDirectory: false, path: 'plugins/Plugin2.jar.disabled' },
        { name: 'Plugin3.jar', isDirectory: false, path: 'plugins/Plugin3.jar' },
      ];

      (fileManager.listDir as ReturnType<typeof vi.fn>).mockResolvedValue(mockFiles);
      (fileManager.downloadFile as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Cannot read JAR'),
      );

      const result = await scanner.scan('server1');

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.filename)).toEqual([
        'Plugin1.jar',
        'Plugin2.jar.disabled',
        'Plugin3.jar',
      ]);
    });
  });
});