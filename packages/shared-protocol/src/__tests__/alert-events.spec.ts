import { describe, it, expect } from 'vitest';
import { AlertChannel, createAlertFiredMessage, createAlertAckMessage, createAlertSummaryMessage } from '../alert-events.js';
import type { AlertDto, AlertSummaryDto } from '@jian-agent/shared-domain';

describe('AlertChannel', () => {
  it('should have expected channels', () => {
    expect(AlertChannel.ALERT_FIRED).toBe('alert:fired');
    expect(AlertChannel.ALERT_ACK).toBe('alert:ack');
    expect(AlertChannel.ALERT_SUMMARY).toBe('alert:summary');
  });
});

describe('createAlertFiredMessage', () => {
  it('should create message with alert', () => {
    const alert: AlertDto = {
      id: 'a-1', timestamp: '2026-01-01T00:00:00Z',
      level: 'CRITICAL', ruleId: 'r-1', ruleName: 'Low TPS',
      message: 'TPS below 15', value: 12.5, threshold: 15,
      acknowledged: false,
    };
    const msg = createAlertFiredMessage(alert);
    expect(msg.channel).toBe('alert:fired');
    expect(msg.payload.alert.id).toBe('a-1');
  });
});

describe('createAlertAckMessage', () => {
  it('should create ack message', () => {
    const msg = createAlertAckMessage('a-1');
    expect(msg.payload.alertId).toBe('a-1');
  });
});

describe('createAlertSummaryMessage', () => {
  it('should create summary message', () => {
    const summary: AlertSummaryDto = {
      totalActive: 5, criticalCount: 1, warningCount: 3, infoCount: 1,
    };
    const msg = createAlertSummaryMessage(summary);
    expect(msg.payload.summary.totalActive).toBe(5);
  });
});
