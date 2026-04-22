import { EventEmitter } from 'node:events';
import type { IPty } from 'node-pty';

export class PtySession extends EventEmitter {
  public readonly sessionId: string;
  private pty: IPty | null = null;

  constructor(sessionId: string) {
    super();
    this.sessionId = sessionId;
  }

  start(shell: string, args: string[], options: { cwd?: string; env?: Record<string, string>; cols?: number; rows?: number }): void {
    const nodePty = require('node-pty');
    this.pty = nodePty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: options.cols ?? 120,
      rows: options.rows ?? 30,
      cwd: options.cwd,
      env: options.env as any,
    });

    this.pty!.onData((data: string) => {
      this.emit('data', data);
    });

    this.pty!.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
      this.emit('exit', { exitCode, signal });
      this.pty = null;
    });
  }

  write(data: string): void {
    this.pty?.write(data);
  }

  resize(cols: number, rows: number): void {
    this.pty?.resize(cols, rows);
  }

  kill(): void {
    this.pty?.kill();
    this.pty = null;
  }

  isAlive(): boolean {
    return this.pty !== null;
  }
}
