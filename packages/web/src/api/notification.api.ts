import { apiFetch } from './client.js';
import type {
  NotificationChannelDto,
  CreateNotificationChannelRequest,
  UpdateNotificationChannelRequest,
} from '@jian-agent/shared-domain';

export const notificationApi = {
  listChannels: () =>
    apiFetch<readonly NotificationChannelDto[]>('/notification-channels'),

  createChannel: (request: CreateNotificationChannelRequest) =>
    apiFetch<NotificationChannelDto>('/notification-channels', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  updateChannel: (id: string, request: UpdateNotificationChannelRequest) =>
    apiFetch<NotificationChannelDto>(`/notification-channels/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    }),

  deleteChannel: (id: string) =>
    apiFetch<{ success: boolean }>(`/notification-channels/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  testChannel: (id: string) =>
    apiFetch<{ success: boolean; message: string }>(`/notification-channels/${encodeURIComponent(id)}/test`, {
      method: 'POST',
    }),
} as const;
