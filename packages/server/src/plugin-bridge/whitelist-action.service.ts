import { Injectable, Logger } from '@nestjs/common';
import { PluginBridgeService } from './plugin-bridge.service.js';
import type {
  WhitelistActionRequest,
  WhitelistActionResult,
} from '@jian-agent/shared-domain';
import { randomUUID } from 'crypto';

interface PendingAction {
  readonly resolve: (result: WhitelistActionResult) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

@Injectable()
export class WhitelistActionService {
  private readonly logger = new Logger(WhitelistActionService.name);
  private readonly pending = new Map<string, PendingAction>();
  private static readonly ACTION_TIMEOUT_MS = 10_000;

  private static readonly ALLOWED_ACTIONS: ReadonlySet<string> = new Set([
    'teleport',
    'give_equipment',
    'reset_map',
    'countdown',
    'force_start',
    'stop_game',
  ]);

  constructor(private readonly bridgeService: PluginBridgeService) {}

  async execute(
    serverId: string,
    request: WhitelistActionRequest,
  ): Promise<WhitelistActionResult> {
    if (!WhitelistActionService.ALLOWED_ACTIONS.has(request.action)) {
      return {
        action: request.action,
        success: false,
        message: `Action not in whitelist: ${request.action}`,
        timestamp: new Date().toISOString(),
      };
    }

    const requestId = randomUUID();

    const sent = this.bridgeService.sendCommand(
      serverId,
      `action:${request.action}`,
      { ...request.params, requestId },
      requestId,
    );

    if (!sent) {
      return {
        action: request.action,
        success: false,
        message: 'Plugin not connected',
        timestamp: new Date().toISOString(),
      };
    }

    return this.waitForResult(requestId, request.action);
  }

  handleActionResult(requestId: string, result: WhitelistActionResult): void {
    const pending = this.pending.get(requestId);
    if (!pending) {
      this.logger.warn(`No pending action for requestId=${requestId}`);
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(requestId);
    pending.resolve(result);
  }

  listAllowedActions(): readonly string[] {
    return [...WhitelistActionService.ALLOWED_ACTIONS];
  }

  private waitForResult(
    requestId: string,
    action: string,
  ): Promise<WhitelistActionResult> {
    return new Promise<WhitelistActionResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        resolve({
          action,
          success: false,
          message: 'Action timed out',
          timestamp: new Date().toISOString(),
        });
      }, WhitelistActionService.ACTION_TIMEOUT_MS);

      this.pending.set(requestId, { resolve, timer });
    });
  }
}
