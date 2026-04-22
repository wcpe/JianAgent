export type NotificationChannelType = 'webhook' | 'dingtalk';

export interface NotificationChannelDto {
  readonly id: string;
  readonly name: string;
  readonly type: NotificationChannelType;
  readonly url: string;
  readonly secret: string;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateNotificationChannelRequest {
  readonly name: string;
  readonly type: NotificationChannelType;
  readonly url: string;
  readonly secret?: string;
  readonly enabled?: boolean;
}

export interface UpdateNotificationChannelRequest {
  readonly name?: string;
  readonly url?: string;
  readonly secret?: string;
  readonly enabled?: boolean;
}
