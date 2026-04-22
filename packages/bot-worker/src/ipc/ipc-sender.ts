import type { IpcMessage, IpcCommand } from '@jian-agent/shared-protocol';

export function createIpcSender(): (msg: IpcMessage<unknown>) => void {
  return (msg) => {
    if (process.send) {
      process.send(msg);
    }
  };
}
