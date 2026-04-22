import { Injectable, Logger } from '@nestjs/common';
import { join, resolve } from 'node:path';
import AdmZip from 'adm-zip';
import yaml from 'js-yaml';
import { PluginInstallState } from '@jian-agent/shared-domain';
import { FileManagerService } from '../../file-manager/file-manager.service.js';
import { ServerConfigService } from '../../server-process/server-config.service.js';
import type {
  PluginScanner,
  DiskPluginEntry,
  PluginDescriptor,
} from './plugin-scanner.interface.js';

/** Internal shape of plugin.yml / paper-plugin.yml. */
interface PluginYml {
  name?: string;
  version?: string;
  description?: string;
  main?: string;
  'api-version'?: string;
  author?: string;
  authors?: string[];
  depend?: string[];
  softdepend?: string[];
  website?: string;
}

const PLUGINS_DIR = 'plugins';

@Injectable()
export class JarPluginScanner implements PluginScanner {
  private readonly logger = new Logger(JarPluginScanner.name);

  constructor(
    private readonly fileManager: FileManagerService,
    private readonly configService: ServerConfigService,
  ) {}

  async scan(serverId: string): Promise<readonly DiskPluginEntry[]> {
    let files;
    try {
      files = await this.fileManager.listDir(serverId, PLUGINS_DIR);
    } catch {
      this.logger.warn(`Failed to list plugins directory for server ${serverId}`);
      return [];
    }

    const jarFiles = files.filter(
      (f) =>
        !f.isDirectory &&
        (f.name.endsWith('.jar') || f.name.endsWith('.jar.disabled')),
    );

    const entries: DiskPluginEntry[] = [];

    for (const jar of jarFiles) {
      const disabledOnDisk = jar.name.endsWith('.jar.disabled');
      const descriptor = await this.readDescriptor(serverId, jar.path);
      const key = (descriptor?.name ?? this.stemOf(jar.name)).toLowerCase();

      entries.push({
        key,
        filename: jar.name,
        path: jar.path,
        disabledOnDisk,
        descriptor,
        installState: disabledOnDisk
          ? PluginInstallState.DISABLED
          : PluginInstallState.INSTALLED,
      });
    }

    return entries;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Strip .jar / .jar.disabled suffix to get filename stem. */
  private stemOf(filename: string): string {
    return filename.replace(/\.jar(\.disabled)?$/i, '');
  }

  /**
   * Read plugin.yml (or paper-plugin.yml) from a JAR on disk.
   * Returns null if the YAML is missing or unreadable.
   */
  private async readDescriptor(
    serverId: string,
    jarRelativePath: string,
  ): Promise<PluginDescriptor | null> {
    try {
      const jarBuffer = await this.fileManager.downloadFile(serverId, jarRelativePath);
      const zip = new AdmZip(jarBuffer);
      const entry =
        zip.getEntry('plugin.yml') ?? zip.getEntry('paper-plugin.yml');
      if (!entry) return null;

      const content = entry.getData().toString('utf-8');
      const parsed = yaml.load(content) as PluginYml | null;
      if (!parsed || typeof parsed !== 'object') return null;

      const authors: string[] = [];
      if (parsed.authors && Array.isArray(parsed.authors)) {
        authors.push(...parsed.authors.map(String));
      } else if (parsed.author) {
        authors.push(String(parsed.author));
      }

      return {
        name: parsed.name ?? '',
        version: parsed.version != null ? String(parsed.version) : '',
        authors,
        description: parsed.description ?? undefined,
        main: parsed.main ?? undefined,
        apiVersion: parsed['api-version'] ?? undefined,
        depend: parsed.depend ?? undefined,
        softDepend: parsed.softdepend ?? undefined,
        website: parsed.website ?? undefined,
      };
    } catch {
      return null;
    }
  }
}
