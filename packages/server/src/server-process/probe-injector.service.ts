import { Injectable, Logger } from '@nestjs/common';
import { copyFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { readPluginBridgeConfig } from '../common/network-config.js';

/** Location of the pre-built probe-plugin jar, resolved relative to the compiled dist/server-process/ */
const PROBE_JAR_RELATIVE = '../../../../plugin/probe-plugin/build/libs/probe-plugin-1.0.0-SNAPSHOT.jar';
const PROBE_JAR_NAME = 'probe-plugin-1.0.0-SNAPSHOT.jar';
const PROBE_CONFIG_DIR = 'JianAgent';
const PROBE_CONFIG_FILE = 'config.yml';

@Injectable()
export class ProbeInjectorService {
  private readonly logger = new Logger(ProbeInjectorService.name);
  private readonly probeJarPath: string;

  constructor() {
    // Resolve relative to this file's compiled location (dist/server-process/)
    this.probeJarPath = resolve(__dirname, PROBE_JAR_RELATIVE);
  }

  /**
   * Ensure the probe plugin jar and config are present in the server's plugins directory.
   * Called before each server start.
   */
  async inject(workDir: string, serverId: string): Promise<void> {
    const pluginsDir = join(workDir, 'plugins');
    const destJar = join(pluginsDir, PROBE_JAR_NAME);
    const configDir = join(pluginsDir, PROBE_CONFIG_DIR);
    const configFile = join(configDir, PROBE_CONFIG_FILE);

    // 1. Verify source jar exists
    try {
      await stat(this.probeJarPath);
    } catch (err) {
      this.logger.warn(
        `Probe plugin jar not found at ${this.probeJarPath}. ` +
        'Skipping injection — build the probe-plugin first.',
        err,
      );
      return;
    }

    // 2. Ensure plugins directory exists
    await mkdir(pluginsDir, { recursive: true });

    // 3. Copy jar (overwrite to keep up to date)
    try {
      await copyFile(this.probeJarPath, destJar);
      this.logger.log(`Probe plugin jar copied to ${destJar}`);
    } catch (err: unknown) {
      this.logger.error(`Failed to copy probe jar: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    // 4. Write config with correct bridge port and server-id
    await mkdir(configDir, { recursive: true });
    const bridgeConfig = readPluginBridgeConfig();
    const configContent = [
      'bridge:',
      `  host: ${bridgeConfig.host}`,
      `  port: ${bridgeConfig.port}`,
      `  server-id: ${serverId}`,
      '',
      'snapshot:',
      '  interval-ticks: 100',
      '',
    ].join('\n');

    await writeFile(configFile, configContent, 'utf-8');
    this.logger.log(`Probe config written to ${configFile} (bridge=${bridgeConfig.host}:${bridgeConfig.port}, serverId=${serverId})`);
  }
}
