import { Inject, Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../storage/drizzle.provider.js';
import { notificationChannels } from '../storage/schema.js';
import { AlertEngineService } from '../metrics/alert-engine.service.js';
import type {
  NotificationChannelDto,
  NotificationChannelType,
  CreateNotificationChannelRequest,
  UpdateNotificationChannelRequest,
  AlertDto,
} from '@jian-agent/shared-domain';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createHmac } from 'node:crypto';

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
    private readonly alertEngine: AlertEngineService,
  ) {}

  onModuleInit(): void {
    this.alertEngine.on('alert.fired', (alert: AlertDto) => {
      this.dispatchAlert(alert).catch((err) => {
        this.logger.error(`Failed to dispatch alert notification: ${err}`);
      });
    });
    this.logger.log('Notification service initialized, listening for alerts');
  }

  async listChannels(): Promise<readonly NotificationChannelDto[]> {
    const rows = await this.db.select().from(notificationChannels);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type as NotificationChannelType,
      url: r.url,
      secret: r.secret,
      enabled: r.enabled,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async createChannel(request: CreateNotificationChannelRequest): Promise<NotificationChannelDto> {
    const now = new Date().toISOString();
    const channel: NotificationChannelDto = {
      id: randomUUID(),
      name: request.name,
      type: request.type,
      url: request.url,
      secret: request.secret ?? '',
      enabled: request.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(notificationChannels).values({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      url: channel.url,
      secret: channel.secret,
      enabled: channel.enabled,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
    });

    return channel;
  }

  async updateChannel(id: string, request: UpdateNotificationChannelRequest): Promise<NotificationChannelDto> {
    const rows = await this.db.select().from(notificationChannels).where(eq(notificationChannels.id, id));
    if (!rows[0]) throw new NotFoundException('Channel not found');

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updatedAt: now };
    if (request.name !== undefined) updates['name'] = request.name;
    if (request.url !== undefined) updates['url'] = request.url;
    if (request.secret !== undefined) updates['secret'] = request.secret;
    if (request.enabled !== undefined) updates['enabled'] = request.enabled;

    await this.db.update(notificationChannels).set(updates).where(eq(notificationChannels.id, id));

    const updated = await this.db.select().from(notificationChannels).where(eq(notificationChannels.id, id));
    const r = updated[0]!;
    return {
      id: r.id,
      name: r.name,
      type: r.type as NotificationChannelType,
      url: r.url,
      secret: r.secret,
      enabled: r.enabled,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async deleteChannel(id: string): Promise<void> {
    await this.db.delete(notificationChannels).where(eq(notificationChannels.id, id));
  }

  async testChannel(id: string): Promise<{ success: boolean; message: string }> {
    const rows = await this.db.select().from(notificationChannels).where(eq(notificationChannels.id, id));
    if (!rows[0]) throw new NotFoundException('Channel not found');

    const testAlert: AlertDto = {
      id: 'test-' + randomUUID(),
      timestamp: new Date().toISOString(),
      level: 'WARNING',
      ruleId: 'test',
      ruleName: '测试告警规则',
      message: '这是一条测试告警消息',
      serverId: 'test-server',
      value: 0,
      threshold: 0,
      acknowledged: false,
    };

    try {
      await this.sendToChannel(rows[0], testAlert);
      return { success: true, message: '测试消息发送成功' };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : '发送失败' };
    }
  }

  // --- Private ---

  private async dispatchAlert(alert: AlertDto): Promise<void> {
    const channels = await this.db.select().from(notificationChannels);
    const enabledChannels = channels.filter((c) => c.enabled);

    for (const channel of enabledChannels) {
      try {
        await this.sendToChannel(channel, alert);
      } catch (err) {
        this.logger.error(`Failed to send alert to channel ${channel.name}: ${err}`);
      }
    }
  }

  private async sendToChannel(channel: typeof notificationChannels.$inferSelect, alert: AlertDto): Promise<void> {
    switch (channel.type) {
      case 'webhook':
        await this.sendWebhook(channel.url, channel.secret, alert);
        break;
      case 'dingtalk':
        await this.sendDingTalk(channel.url, channel.secret, alert);
        break;
      default:
        this.logger.warn(`Unknown channel type: ${channel.type}`);
    }
  }

  private async sendWebhook(url: string, secret: string, alert: AlertDto): Promise<void> {
    const body = JSON.stringify({
      event: 'alert',
      alert: {
        id: alert.id,
        level: alert.level,
        ruleName: alert.ruleName,
        message: alert.message,
        serverId: alert.serverId,
        value: alert.value,
        threshold: alert.threshold,
        timestamp: alert.timestamp,
      },
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (secret) {
      const signature = createHmac('sha256', secret).update(body).digest('hex');
      headers['X-Signature'] = signature;
    }

    const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      throw new Error(`Webhook returned ${res.status}: ${await res.text()}`);
    }
  }

  private async sendDingTalk(url: string, secret: string, alert: AlertDto): Promise<void> {
    let finalUrl = url;

    // DingTalk signature
    if (secret) {
      const timestamp = Date.now();
      const stringToSign = `${timestamp}\n${secret}`;
      const sign = createHmac('sha256', secret).update(stringToSign).digest('base64');
      const separator = url.includes('?') ? '&' : '?';
      finalUrl = `${url}${separator}timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
    }

    const levelEmoji: Record<string, string> = {
      CRITICAL: '🔴',
      WARNING: '🟡',
      INFO: '🔵',
    };

    const body = JSON.stringify({
      msgtype: 'markdown',
      markdown: {
        title: `${levelEmoji[alert.level] ?? '⚪'} JianAgent 告警`,
        text: [
          `### ${levelEmoji[alert.level] ?? '⚪'} ${alert.level} 告警`,
          '',
          `**规则**: ${alert.ruleName}`,
          `**消息**: ${alert.message}`,
          `**服务器**: ${alert.serverId ?? 'N/A'}`,
          `**当前值**: ${alert.value}`,
          `**阈值**: ${alert.threshold}`,
          `**时间**: ${new Date(alert.timestamp).toLocaleString('zh-CN')}`,
        ].join('\n'),
      },
    });

    const res = await fetch(finalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`DingTalk returned ${res.status}: ${await res.text()}`);
    }
  }
}
