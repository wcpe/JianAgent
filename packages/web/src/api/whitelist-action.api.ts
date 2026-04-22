import { apiFetch } from './client.js';
import type { WhitelistActionRequest, WhitelistActionResult } from '@jian-agent/shared-domain';

export async function executeWhitelistAction(
  serverId: string,
  request: WhitelistActionRequest,
): Promise<{ success: boolean; data: WhitelistActionResult }> {
  return apiFetch(`/plugin-bridge/whitelist-action/${encodeURIComponent(serverId)}`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function listWhitelistActions(): Promise<{ success: true; data: readonly string[] }> {
  return apiFetch('/plugin-bridge/whitelist-actions');
}
