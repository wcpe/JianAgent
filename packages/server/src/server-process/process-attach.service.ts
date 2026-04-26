import { Injectable, Logger } from '@nestjs/common';
import { ServerState } from '@jian-agent/shared-domain';

@Injectable()
export class ProcessAttachService {
  private readonly logger = new Logger(ProcessAttachService.name);
  private readonly attachedPids = new Map<string, number>();

  async attachByPid(serverIdOrPid: string | number, maybePid?: number): Promise<{ success: boolean; state: ServerState }> {
    const serverId = typeof serverIdOrPid === 'string' ? serverIdOrPid : 'default';
    const pid = typeof serverIdOrPid === 'number' ? serverIdOrPid : maybePid;

    if (pid === undefined) {
      return { success: false, state: ServerState.UNKNOWN };
    }

    try {
      process.kill(pid, 0);
      this.attachedPids.set(serverId, pid);
      this.logger.log(`Attached to external process server=${serverId} PID=${pid}`);
      return { success: true, state: ServerState.ATTACHED_EXTERNAL };
    } catch (err) {
      this.logger.debug(`PID ${pid} is not alive`, err);
      return { success: false, state: ServerState.UNKNOWN };
    }
  }

  getAttachedPid(serverId = 'default'): number | undefined {
    return this.attachedPids.get(serverId);
  }

  detach(serverId = 'default'): void {
    this.attachedPids.delete(serverId);
  }
}
