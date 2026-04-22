import { Injectable, OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
import { WsChannel, createWsMessage } from '@jian-agent/shared-protocol';
import { RealtimeGateway } from './realtime.gateway.js';

/** Max log lines kept in memory for history */
const LOG_BUFFER_SIZE = 500;

@Injectable()
export class NodeLogBridgeService implements OnModuleInit {
  private readonly logger = new Logger(NodeLogBridgeService.name);
  private readonly logBuffer: string[] = [];
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

  getLogBuffer(): readonly string[] {
    return this.logBuffer;
  }

  private pushToBuffer(line: string): void {
    this.logBuffer.push(line);
    if (this.logBuffer.length > LOG_BUFFER_SIZE) {
      this.logBuffer.splice(0, this.logBuffer.length - LOG_BUFFER_SIZE);
    }
  }

  private broadcast(line: string): void {
    this.pushToBuffer(line);
    try {
      this.gateway.broadcastChannel(WsChannel.TERMINAL_SESSION_NODE_LOG as any, { data: line });
    } catch {
      // Gateway may not be fully ready yet during startup
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
        this.broadcast(text);
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
        this.broadcast(text);
      }
      return original(chunk, encodingOrCb as BufferEncoding, cb);
    }) as typeof process.stderr.write;
  }
}
