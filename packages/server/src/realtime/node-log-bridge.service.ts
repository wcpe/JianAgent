import { Injectable, OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
import { WsChannel, createWsMessage } from '@jian-agent/shared-protocol';
import { RealtimeGateway } from './realtime.gateway.js';

/** Max log lines kept in memory for history */
const LOG_BUFFER_SIZE = 500;

export interface NodeLogEntry {
  readonly timestamp: string;
  readonly level: string;
  readonly context: string;
  readonly message: string;
  readonly raw: string;
}

@Injectable()
export class NodeLogBridgeService implements OnModuleInit {
  private readonly logger = new Logger(NodeLogBridgeService.name);
  private readonly logBuffer: NodeLogEntry[] = [];
  private originalStdoutWrite: typeof process.stdout.write | null = null;
  private originalStderrWrite: typeof process.stderr.write | null = null;

  constructor(
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly gateway: RealtimeGateway,
  ) {}

  onModuleInit(): void {
    this.hookStdout();
    this.hookStderr();
    this.logger.log('Node log bridge active — capturing stdout/stderr');
  }

  getLogBuffer(): readonly NodeLogEntry[] {
    return this.logBuffer;
  }

  getFilteredBuffer(levels?: string[], keyword?: string): readonly NodeLogEntry[] {
    let result = this.logBuffer;
    if (levels?.length) {
      const set = new Set(levels.map(l => l.toUpperCase()));
      result = result.filter(e => set.has(e.level));
    }
    if (keyword) {
      const lower = keyword.toLowerCase();
      result = result.filter(e => e.message.toLowerCase().includes(lower) || e.raw.toLowerCase().includes(lower));
    }
    return result;
  }

  private pushToBuffer(entry: NodeLogEntry): void {
    this.logBuffer.push(entry);
    if (this.logBuffer.length > LOG_BUFFER_SIZE) {
      this.logBuffer.splice(0, this.logBuffer.length - LOG_BUFFER_SIZE);
    }
  }

  private parseNestjsLog(text: string, isStderr: boolean): NodeLogEntry {
    const stripped = text.replace(/\x1b\[[0-9;]*m/g, '').trim();
    const match = stripped.match(/^\[Nest\]\s*\d+\s*-\s*(.+?)\s{2,}(\w+)\s+\[(.+?)]\s*(.*)/);
    if (match) {
      const levelMap: Record<string, string> = { LOG: 'INFO', VERBOSE: 'DEBUG', FATAL: 'FATAL' };
      return {
        timestamp: match[1],
        level: levelMap[match[2]] ?? match[2],
        context: match[3],
        message: match[4],
        raw: text,
      };
    }
    return {
      timestamp: new Date().toISOString(),
      level: isStderr ? 'ERROR' : 'INFO',
      context: '',
      message: stripped || text,
      raw: text,
    };
  }

  private broadcast(line: string, isStderr: boolean): void {
    const entry = this.parseNestjsLog(line, isStderr);
    this.pushToBuffer(entry);
    try {
      this.gateway.broadcastChannel(WsChannel.TERMINAL_SESSION_NODE_LOG as any, { data: entry });
    } catch (err) {
      this.logger.debug('Gateway may not be fully ready yet during startup', err);
    }
  }

  private hookStdout(): void {
    const original = process.stdout.write.bind(process.stdout);
    this.originalStdoutWrite = original;

    process.stdout.write = ((
      chunk: string | Uint8Array,
      encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
      cb?: (err?: Error | null) => void,
    ): boolean => {
      const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
      if (text.trim()) {
        this.broadcast(text, false);
      }
      return original(chunk, encodingOrCb as BufferEncoding, cb);
    }) as typeof process.stdout.write;
  }

  private hookStderr(): void {
    const original = process.stderr.write.bind(process.stderr);
    this.originalStderrWrite = original;

    process.stderr.write = ((
      chunk: string | Uint8Array,
      encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
      cb?: (err?: Error | null) => void,
    ): boolean => {
      const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
      if (text.trim()) {
        this.broadcast(text, true);
      }
      return original(chunk, encodingOrCb as BufferEncoding, cb);
    }) as typeof process.stderr.write;
  }
}
