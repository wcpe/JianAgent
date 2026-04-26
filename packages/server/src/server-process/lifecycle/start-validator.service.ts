import { Injectable, Logger } from '@nestjs/common';
import { access, mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import type { ServerConfig, ServerValidationResult } from '@jian-agent/shared-domain';

@Injectable()
export class StartValidatorService {
  private readonly logger = new Logger(StartValidatorService.name);

  async validate(config: Partial<ServerConfig> & { id: string }): Promise<ServerValidationResult> {
    const errors: Array<{ field: string; message: string; severity: 'error' | 'warning' }> = [];

    // 1. jarPath exists
    if (config.jarPath) {
      try {
        await access(config.jarPath, 4);
      } catch (_err) {
        errors.push({ field: 'jarPath', message: `jarPath ${config.jarPath} 不存在或无读权限`, severity: 'error' });
      }
    } else {
      errors.push({ field: 'jarPath', message: 'jarPath 未配置', severity: 'error' });
    }

    // 2. workDir writable (auto-create if missing)
    if (config.workDir) {
      try {
        await mkdir(config.workDir, { recursive: true });
        await access(config.workDir, 2);
      } catch (_err) {
        errors.push({ field: 'workDir', message: `workDir ${config.workDir} 不可写`, severity: 'error' });
      }
    } else {
      errors.push({ field: 'workDir', message: 'workDir 未配置', severity: 'error' });
    }

    // 3. javaPath executable
    const javaPath = config.javaPath || 'java';
    try {
      const { execFileSync } = await import('node:child_process');
      execFileSync(javaPath, ['--version'], { timeout: 5000, stdio: 'pipe' });
    } catch (_err) {
      try {
        const { execFileSync } = await import('node:child_process');
        execFileSync(javaPath, ['-version'], { timeout: 5000, stdio: 'pipe' });
      } catch (_err2) {
        errors.push({ field: 'javaPath', message: `javaPath ${javaPath} 不可执行`, severity: 'error' });
      }
    }

    // 4. port not in use
    const port = config.port ?? 25565;
    const portFree = await this.isPortFree(port);
    if (!portFree) {
      errors.push({ field: 'port', message: `端口 ${port} 已被占用`, severity: 'error' });
    }

    // 5. jvmArgs format warnings
    if (config.jvmArgs) {
      for (const arg of config.jvmArgs) {
        if (/^-Xmx/.test(arg) && !/^-Xmx\d+[kmgKMG]?$/.test(arg)) {
          errors.push({ field: 'jvmArgs', message: `JVM 参数格式异常: ${arg}`, severity: 'warning' });
        }
        if (/^-Xms/.test(arg) && !/^-Xms\d+[kmgKMG]?$/.test(arg)) {
          errors.push({ field: 'jvmArgs', message: `JVM 参数格式异常: ${arg}`, severity: 'warning' });
        }
      }
    }

    const valid = errors.every((e) => e.severity !== 'error');
    return { serverId: config.id, valid, errors };
  }

  private isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const srv = createServer();
      srv.once('error', () => resolve(false));
      srv.listen(port, () => {
        srv.close(() => resolve(true));
      });
    });
  }
}
