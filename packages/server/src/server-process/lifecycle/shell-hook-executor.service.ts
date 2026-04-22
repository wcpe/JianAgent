import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'node:child_process';
import type { HookResult } from '@jian-agent/shared-domain';

@Injectable()
export class ShellHookExecutor {
  private readonly logger = new Logger(ShellHookExecutor.name);

  async exec(command: string, workDir: string, timeoutMs: number): Promise<HookResult> {
    if (!command || !command.trim()) {
      return { command, exitCode: 0, stdout: '', stderr: '', durationMs: 0, timedOut: false };
    }

    const start = Date.now();

    return new Promise((resolve) => {
      const child = exec(command, {
        cwd: workDir,
        timeout: timeoutMs,
        env: process.env,
      }, (error, stdout, stderr) => {
        const durationMs = Date.now() - start;
        resolve({
          command,
          exitCode: error ? (error as any).code ?? 1 : 0,
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          durationMs,
          timedOut: (error as any)?.killed === true && durationMs >= timeoutMs - 100,
        });
      });

      child.on('error', (err) => {
        this.logger.error(`Hook execution error: ${err.message}`);
      });
    });
  }
}
