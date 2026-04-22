import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { LocalValidationEvidenceDto, LocalValidationEvidenceKind } from '@jian-agent/shared-domain';
import { LocalValidationStore } from './local-validation.store.js';
import type { ValidationReport } from './validation-report.service.js';

export interface AppendValidationEvidenceInput {
  readonly summary: string;
  readonly payload: Record<string, unknown>;
  readonly timestamp?: string;
  readonly evidenceKind?: LocalValidationEvidenceKind;
}

export interface LocalValidationEvidenceEventPayload {
  readonly runId: string;
  readonly evidenceId: string;
  readonly kind: LocalValidationEvidenceKind;
  readonly summary: string;
  readonly payload: Record<string, unknown>;
  readonly timestamp: number;
}

@Injectable()
export class ValidationEvidenceService {
  constructor(
    private readonly store: LocalValidationStore,
    @Inject(EventEmitter2) private readonly eventBus: EventEmitter2,
  ) {}

  appendEvidence(runId: string, input: AppendValidationEvidenceInput): Promise<LocalValidationEvidenceDto> {
    return this.persistAndEmit(runId, {
      ...input,
      evidenceKind: input.evidenceKind ?? 'operation',
    });
  }

  appendOperationEvidence(runId: string, summary: string, payload: Record<string, unknown>): Promise<LocalValidationEvidenceDto> {
    return this.appendEvidence(runId, { summary, payload, evidenceKind: 'operation' });
  }

  appendBotEventEvidence(runId: string, summary: string, payload: Record<string, unknown>): Promise<LocalValidationEvidenceDto> {
    return this.appendEvidence(runId, { summary, payload, evidenceKind: 'bot-event' });
  }

  appendStartupReport(runId: string, report: ValidationReport): Promise<LocalValidationEvidenceDto> {
    return this.appendOperationEvidence(runId, '启动报告', { report });
  }

  appendFailureEvidence(runId: string, summary: string, payload: Record<string, unknown>): Promise<LocalValidationEvidenceDto> {
    return this.appendOperationEvidence(runId, summary, payload);
  }

  private async persistAndEmit(runId: string, input: AppendValidationEvidenceInput): Promise<LocalValidationEvidenceDto> {
    const evidence = await this.store.appendEvidence({
      runId,
      evidenceKind: input.evidenceKind ?? 'operation',
      summary: input.summary,
      payload: input.payload,
      timestamp: input.timestamp,
    });

    this.eventBus.emit('local-validation.evidence', {
      runId: evidence.runId,
      evidenceId: evidence.id,
      kind: evidence.kind,
      summary: evidence.summary,
      payload: evidence.payload,
      timestamp: Date.now(),
    } satisfies LocalValidationEvidenceEventPayload);

    return evidence;
  }
}
