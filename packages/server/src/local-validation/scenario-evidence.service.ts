/**
 * Stage-specific evidence collection for local validation scenarios.
 *
 * Extracted from LocalValidationScenarioService — handles gathering
 * build telemetry and chat message counts during scenario stages.
 */

import { Injectable } from '@nestjs/common';
import { BotRealtimeService } from '../bot/bot-realtime.service.js';
import {
  RECENT_CHAT_MESSAGE_LIMIT,
  RECENT_BOT_EVENT_LIMIT,
  BUILD_FAILURE_SAMPLE_LIMIT,
} from './scenario-constants.js';

export interface BuildTelemetry {
  readonly attempts: number;
  readonly successBots: ReadonlySet<string>;
  readonly failureReasonCounts: Record<string, number>;
  readonly failureSamples: readonly Record<string, unknown>[];
}

export interface ChatCountResult {
  readonly chattingBots: number;
  readonly messages: readonly { botName: string; message: string; timestamp: number }[];
}

@Injectable()
export class ScenarioEvidenceService {
  constructor(
    private readonly botRealtime: BotRealtimeService,
  ) {}

  collectBuildTelemetry(
    runId: string,
    batchId: string,
    sinceTimestamp: number,
  ): BuildTelemetry {
    const events = this.botRealtime.getRecentBotEvents({
      validationRunId: runId,
      batchId,
      sinceTimestamp,
      limit: RECENT_BOT_EVENT_LIMIT,
    });

    const successBots = new Set<string>();
    const failureReasonCounts: Record<string, number> = {};
    const failureSamples: Array<Record<string, unknown>> = [];
    let attempts = 0;

    for (const event of events) {
      if (event.event === 'BUILD_ATTEMPT') {
        attempts += 1;
        continue;
      }
      if (event.event === 'BUILD_SUCCESS') {
        successBots.add(event.botName);
        continue;
      }
      if (event.event !== 'BUILD_FAILURE') {
        continue;
      }

      const reason = typeof event.metadata?.['reason'] === 'string'
        ? event.metadata['reason']
        : 'unknown';
      failureReasonCounts[reason] = (failureReasonCounts[reason] ?? 0) + 1;
      if (failureSamples.length < BUILD_FAILURE_SAMPLE_LIMIT) {
        failureSamples.push({
          botName: event.botName,
          reason,
          message: event.message,
          metadata: event.metadata ?? {},
        });
      }
    }

    return {
      attempts,
      successBots,
      failureReasonCounts,
      failureSamples,
    };
  }

  collectChattingBotCount(
    runId: string,
    batchId: string,
    sinceTimestamp: number,
    chattingGroup: readonly string[],
  ): ChatCountResult {
    const chatMessages = this.botRealtime.getRecentChatMessages({
      validationRunId: runId,
      batchId,
      sinceTimestamp,
      limit: RECENT_CHAT_MESSAGE_LIMIT,
    });
    const chattingBots = new Set(
      chatMessages
        .filter((message) => chattingGroup.includes(message.botName))
        .map((message) => message.botName),
    ).size;

    return {
      chattingBots,
      messages: chatMessages,
    };
  }
}
