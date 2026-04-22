import { apiFetch } from './client.js';
import type {
  BotGroupDto,
  CreateBotGroupRequestDto,
  ModifyBotGroupRequestDto,
  ApplyBehaviorToGroupDto,
  BehaviorTemplateDto,
  CreateBehaviorTemplateDto,
  UpdateBehaviorTemplateDto,
} from '@jian-agent/shared-domain';

// ── Bot Groups ──

export async function listBotGroups(
  sessionId: string,
): Promise<{ success: boolean; data: readonly BotGroupDto[] }> {
  return apiFetch(`/bot/groups?sessionId=${encodeURIComponent(sessionId)}`);
}

export async function createBotGroup(
  dto: CreateBotGroupRequestDto,
): Promise<{ success: boolean; data: BotGroupDto }> {
  return apiFetch('/bot/groups', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function addBotsToGroup(
  groupId: string,
  dto: ModifyBotGroupRequestDto,
): Promise<{ success: boolean; data: BotGroupDto }> {
  return apiFetch(`/bot/groups/${encodeURIComponent(groupId)}/add`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

export async function removeBotsFromGroup(
  groupId: string,
  dto: ModifyBotGroupRequestDto,
): Promise<{ success: boolean; data: BotGroupDto }> {
  return apiFetch(`/bot/groups/${encodeURIComponent(groupId)}/remove`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

export async function deleteBotGroup(groupId: string): Promise<{ success: boolean }> {
  return apiFetch(`/bot/groups/${encodeURIComponent(groupId)}`, {
    method: 'DELETE',
  });
}

export async function applyBehaviorToGroup(
  groupId: string,
  dto: ApplyBehaviorToGroupDto,
): Promise<{ success: boolean }> {
  return apiFetch(`/bot/groups/${encodeURIComponent(groupId)}/apply-behavior`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

// ── Behavior Templates ──

export async function listBehaviorTemplates(): Promise<{
  success: boolean;
  data: readonly BehaviorTemplateDto[];
}> {
  return apiFetch('/behavior-templates');
}

export async function createBehaviorTemplate(
  dto: CreateBehaviorTemplateDto,
): Promise<{ success: boolean; data: BehaviorTemplateDto }> {
  return apiFetch('/behavior-templates', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function updateBehaviorTemplate(
  id: string,
  dto: UpdateBehaviorTemplateDto,
): Promise<{ success: boolean; data: BehaviorTemplateDto }> {
  return apiFetch(`/behavior-templates/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

export async function deleteBehaviorTemplate(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/behavior-templates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
