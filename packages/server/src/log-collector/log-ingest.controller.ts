import { Controller, Post, Body, Logger } from '@nestjs/common';
import { LogParserService } from './log-parser.service.js';
import { LogIngestService } from './log-ingest.service.js';

interface FluentBitEntry {
  log: string;
  [key: string]: unknown;
}

interface LogIngestRequest {
  entries: FluentBitEntry[];
  hostId?: string;
  hostName?: string;
  hostType?: 'local' | 'remote';
  sourceFile?: string;
  format?: string;
}

@Controller('log-ingest')
export class LogIngestController {
  private readonly logger = new Logger(LogIngestController.name);

  constructor(
    private readonly parser: LogParserService,
    private readonly ingestService: LogIngestService,
  ) {}

  /**
   * Fluent Bit HTTP output endpoint.
   * Accepts an array of entries with a "log" field.
   *
   * Also supports structured requests from internal collectors.
   */
  @Post()
  async ingest(@Body() body: LogIngestRequest | FluentBitEntry[]) {
    const isStructured = !Array.isArray(body) && body.entries;
    const entries: FluentBitEntry[] = isStructured
      ? (body as LogIngestRequest).entries
      : (body as FluentBitEntry[]);

    const meta = {
      hostId: isStructured ? (body as LogIngestRequest).hostId ?? 'local' : 'local',
      hostName: isStructured ? (body as LogIngestRequest).hostName ?? 'Local' : 'Local',
      hostType: (isStructured ? (body as LogIngestRequest).hostType : undefined) ?? ('local' as const),
      sourceFile: isStructured ? (body as LogIngestRequest).sourceFile ?? 'fluent-bit' : 'fluent-bit',
    };

    const format = isStructured ? (body as LogIngestRequest).format ?? 'mc' : 'mc';

    const parsed = entries.map((e) => this.parser.parseLine(e.log, format));
    const count = await this.ingestService.writeEntries(parsed, meta);

    this.logger.debug(`Ingested ${count} entries from ${meta.sourceFile}`);
    return { ingested: count };
  }
}
