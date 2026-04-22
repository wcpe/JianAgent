import type { EventReportPayload, BotEventType } from '@jian-agent/shared-protocol';

export class EventReporter {
  constructor(
    private readonly send: (payload: EventReportPayload) => void,
    private readonly groupId: string = 'default',
  ) {}

  report(
    botName: string,
    type: BotEventType,
    detail?: string,
    metadata?: Readonly<Record<string, unknown>>,
  ): void {
    this.send({
      events: [
        {
          botName,
          groupId: this.groupId,
          event: type,
          message: detail ?? '',
          timestamp: Date.now(),
          metadata,
        },
      ],
    });
  }
}
