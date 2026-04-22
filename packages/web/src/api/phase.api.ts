import { apiFetch } from './client.js';
import type { PhaseSummaryDto, PhaseExitConfigDto } from '@jian-agent/shared-domain';

export async function getPhaseSummaries(
  sessionId: string,
): Promise<{ success: boolean; data: readonly PhaseSummaryDto[] }> {
  return apiFetch(`/sessions/${encodeURIComponent(sessionId)}/phase-summaries`);
}

export async function injectCustomEvent(
  sessionId: string,
  eventName: string,
): Promise<{ success: boolean }> {
  return apiFetch(`/sessions/${encodeURIComponent(sessionId)}/inject-event`, {
    method: 'POST',
    body: JSON.stringify({ eventName }),
  });
}
