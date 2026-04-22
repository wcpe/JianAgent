import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { Client, SFTPWrapper } from 'ssh2';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
} from '../storage/drizzle.provider.js';
import {
  remoteHosts,
  logCollectionConfigs,
} from '../storage/schema.js';
import { SshPoolService } from '../ssh/ssh-pool.service.js';
import { LogParserService } from './log-parser.service.js';
import { LogIngestService } from './log-ingest.service.js';
import type { SshConnectConfig } from '@jian-agent/shared-domain';

interface RemoteLogConfig {
  configId: string;
  hostId: string;
  hostName: string;
  filePath: string;
  format: string;
  lastOffset: number;
  sshConfig: SshConnectConfig;
}

@Injectable()
export class SshLogReaderService implements OnModuleInit {
  private readonly logger = new Logger(SshLogReaderService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
    private readonly sshPool: SshPoolService,
    private readonly parser: LogParserService,
    private readonly ingestService: LogIngestService,
  ) {}

  async onModuleInit() {
    // Start the polling timer (every 30s)
    this.timer = setInterval(() => this.collectAll().catch(() => {}), 30_000);
    // Run initial collection
    this.collectAll().catch((err) =>
      this.logger.error(`Initial SSH log collection failed: ${err}`),
    );
  }

  /**
   * Collect logs from all enabled remote configs.
   */
  private async collectAll(): Promise<void> {
    const configs = this.db
      .select({
        config: logCollectionConfigs,
        host: remoteHosts,
      })
      .from(logCollectionConfigs)
      .leftJoin(remoteHosts, eq(logCollectionConfigs.hostId, remoteHosts.id))
      .where(
        and(
          eq(logCollectionConfigs.hostType, 'remote'),
          eq(logCollectionConfigs.enabled, true),
        ),
      )
      .all();

    for (const { config, host } of configs) {
      if (!host) {
        this.logger.warn(
          `No remote host found for config ${config.id}, skipping`,
        );
        continue;
      }

      const sshConfig: SshConnectConfig = {
        id: host.id,
        host: host.host,
        port: host.port,
        username: host.username,
        authType: host.authType as 'password' | 'key',
        passwordEncrypted: host.passwordEncrypted,
        keyPath: host.keyPath,
        passphraseEncrypted: host.passphraseEncrypted,
      };

      await this.collectFromRemote({
        configId: config.id,
        hostId: config.hostId,
        hostName: host.name,
        filePath: config.filePath,
        format: config.logFormat,
        lastOffset: config.lastOffset,
        sshConfig,
      });
    }
  }

  /**
   * Incrementally read from a remote log file via SFTP.
   */
  private async collectFromRemote(config: RemoteLogConfig): Promise<void> {
    let client: Client | undefined;
    try {
      // Get SSH connection from pool
      client = await this.sshPool.getConnection(config.sshConfig);

      const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
        client!.sftp((err, sftp) => {
          if (err) reject(err);
          else resolve(sftp);
        });
      });

      const fileStat = await new Promise<{ size: number }>(
        (res, rej) => {
          sftp.stat(config.filePath, (err, stats) => {
            if (err) rej(err);
            else res({ size: stats.size as number });
          });
        },
      );

      if (fileStat.size <= config.lastOffset) {
        sftp.end();
        return;
      }

      // Read from lastOffset, limit to 10MB
      const readEnd = Math.min(
        fileStat.size,
        config.lastOffset + 10 * 1024 * 1024,
      );
      const chunkSize = readEnd - config.lastOffset;

      if (fileStat.size > config.lastOffset + 10 * 1024 * 1024) {
        this.logger.warn(
          `Large log delta for ${config.filePath}, reading 10MB`,
        );
      }

      const stream = sftp.createReadStream(config.filePath, {
        start: config.lastOffset,
        end: readEnd - 1,
      });

      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve());
        stream.on('error', reject);
      });

      const content = Buffer.concat(chunks).toString('utf-8');
      const lines = content.split('\n').filter((l) => l.length > 0);

      if (lines.length > 0) {
        const parsed = lines.map((line) =>
          this.parser.parseLine(line, config.format),
        );

        await this.ingestService.writeEntries(parsed, {
          hostId: config.hostId,
          hostName: config.hostName,
          hostType: 'remote',
          sourceFile: config.filePath,
          lineNumber: config.lastOffset,
        });

        // Update offset to the actual byte position read
        const newOffset = config.lastOffset + Buffer.byteLength(content, 'utf-8');
        await this.ingestService.updateOffset(
          config.configId,
          newOffset,
          createHash('sha256')
            .update(lines[lines.length - 1])
            .digest('hex'),
        );

        this.logger.debug(
          `SSH collected ${lines.length} lines from ${config.hostName}:${config.filePath}`,
        );
      }

      sftp.end();
    } catch (err) {
      this.logger.error(
        `SSH log collection failed for ${config.hostName}:${config.filePath}: ${err}`,
      );
    }
  }

  /** Stop the polling timer */
  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
