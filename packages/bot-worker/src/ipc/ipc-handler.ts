import {
  IpcCommand,
  type IpcMessage,
  type CreateBotsPayload,
  type PingPayload,
  type SetBehaviorPayload,
  type SetPhasePayload,
  type DebugStartPayload,
  type DebugCommandPayload,
  type ExecuteScriptPayload,
  type GetBotDetailPayload,
  type ForceRespawnPayload,
} from '@jian-agent/shared-protocol';

export interface IpcCallbacks {
  onPing(payload: PingPayload): void;
  onCreateBots(payload: CreateBotsPayload): void;
  onSetBehavior(payload: SetBehaviorPayload): void;
  onStopBots(payload: { names: readonly string[] }): void;
  onShutdown(): void;
  onSetPhase(payload: SetPhasePayload): void;
  onDebugStart(payload: DebugStartPayload): void;
  onDebugCommand(payload: DebugCommandPayload): void;
  onDebugStop(payload: { botName: string }): void;
  onExecuteScript(payload: ExecuteScriptPayload): void;
  onStopScript(payload: { botName: string }): void;
  onGetBotDetail(payload: GetBotDetailPayload & { requestId: string }): void;
  onForceRespawn(payload: ForceRespawnPayload): void;
}

export class IpcHandler {
  constructor(private readonly callbacks: Partial<IpcCallbacks>) {}

  handle(msg: IpcMessage<any>): void {
    switch (msg.type) {
      case IpcCommand.PING:
        this.callbacks.onPing?.(msg.payload);
        break;
      case IpcCommand.CREATE_BOTS:
        this.callbacks.onCreateBots?.(msg.payload);
        break;
      case IpcCommand.SET_BEHAVIOR:
        this.callbacks.onSetBehavior?.(msg.payload);
        break;
      case IpcCommand.STOP_BOTS:
        this.callbacks.onStopBots?.(msg.payload);
        break;
      case IpcCommand.SHUTDOWN:
        this.callbacks.onShutdown?.();
        break;
      case IpcCommand.SET_PHASE:
        this.callbacks.onSetPhase?.(msg.payload);
        break;
      case IpcCommand.DEBUG_START:
        this.callbacks.onDebugStart?.(msg.payload);
        break;
      case IpcCommand.DEBUG_COMMAND:
        this.callbacks.onDebugCommand?.(msg.payload);
        break;
      case IpcCommand.DEBUG_STOP:
        this.callbacks.onDebugStop?.(msg.payload);
        break;
      case IpcCommand.EXECUTE_SCRIPT:
        this.callbacks.onExecuteScript?.(msg.payload);
        break;
      case IpcCommand.STOP_SCRIPT:
        this.callbacks.onStopScript?.(msg.payload);
        break;
      case IpcCommand.GET_BOT_DETAIL:
        this.callbacks.onGetBotDetail?.({ ...msg.payload, requestId: msg.requestId ?? '' });
        break;
      case IpcCommand.FORCE_RESPAWN:
        this.callbacks.onForceRespawn?.(msg.payload);
        break;
      default:
        break;
    }
  }
}
