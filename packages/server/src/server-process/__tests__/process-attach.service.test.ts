import { describe, expect, it, vi } from 'vitest';
import { ProcessAttachService } from '../process-attach.service.js';
import { ServerState } from '@jian-agent/shared-domain';

describe('ProcessAttachService', () => {
  it('tracks attached pids independently per server', async () => {
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true as never);
    const service = new ProcessAttachService();

    await expect(service.attachByPid('srv-1', 111)).resolves.toEqual({
      success: true,
      state: ServerState.ATTACHED_EXTERNAL,
    });
    await expect(service.attachByPid('srv-2', 222)).resolves.toEqual({
      success: true,
      state: ServerState.ATTACHED_EXTERNAL,
    });

    expect(service.getAttachedPid('srv-1')).toBe(111);
    expect(service.getAttachedPid('srv-2')).toBe(222);

    service.detach('srv-1');

    expect(service.getAttachedPid('srv-1')).toBeUndefined();
    expect(service.getAttachedPid('srv-2')).toBe(222);

    killSpy.mockRestore();
  });
});