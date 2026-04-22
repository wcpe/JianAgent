import { Injectable, Logger } from '@nestjs/common';
import type {
  ConditionType,
  Combinator,
  PhaseConditionDto,
  PhaseExitConfigDto,
} from '@jian-agent/shared-domain';

interface EvaluatorState {
  readonly sessionId: string;
  readonly phaseIndex: number;
  readonly config: PhaseExitConfigDto;
  readonly startedAt: number;
  readonly timer: ReturnType<typeof setInterval>;
  readonly customEvents: Set<string>;
}

type MetricsProvider = () => { botCount: number; readyBotCount: number; tps: number };

@Injectable()
export class PhaseConditionService {
  private readonly logger = new Logger(PhaseConditionService.name);
  private readonly evaluators = new Map<string, EvaluatorState>();

  private static readonly EVAL_INTERVAL_MS = 2_000;

  private metricsProvider: MetricsProvider = () => ({
    botCount: 0,
    readyBotCount: 0,
    tps: 20,
  });

  setMetricsProvider(provider: MetricsProvider): void {
    this.metricsProvider = provider;
  }

  startEvaluating(
    sessionId: string,
    phaseIndex: number,
    config: PhaseExitConfigDto,
    onTriggered: () => void,
  ): void {
    this.stopEvaluating(sessionId);

    const state: EvaluatorState = {
      sessionId,
      phaseIndex,
      config,
      startedAt: Date.now(),
      customEvents: new Set(),
      timer: setInterval(() => {
        if (this.evaluate(state)) {
          this.stopEvaluating(sessionId);
          onTriggered();
        }
      }, PhaseConditionService.EVAL_INTERVAL_MS),
    };

    this.evaluators.set(sessionId, state);
    this.logger.log(
      `Started evaluating exit conditions for session=${sessionId} phase=${phaseIndex}`,
    );
  }

  stopEvaluating(sessionId: string): void {
    const existing = this.evaluators.get(sessionId);
    if (existing) {
      clearInterval(existing.timer);
      this.evaluators.delete(sessionId);
    }
  }

  injectCustomEvent(sessionId: string, eventName: string): void {
    const state = this.evaluators.get(sessionId);
    if (state) {
      state.customEvents.add(eventName);
    }
  }

  isEvaluating(sessionId: string): boolean {
    return this.evaluators.has(sessionId);
  }

  private evaluate(state: EvaluatorState): boolean {
    const results = state.config.conditions.map((c) =>
      this.evaluateCondition(c, state),
    );

    return state.config.combinator === 'AND'
      ? results.every(Boolean)
      : results.some(Boolean);
  }

  private evaluateCondition(
    condition: PhaseConditionDto,
    state: EvaluatorState,
  ): boolean {
    const metrics = this.metricsProvider();

    switch (condition.type) {
      case 'time_elapsed': {
        const seconds = Number(condition.params['seconds'] ?? 0);
        const elapsed = (Date.now() - state.startedAt) / 1_000;
        return elapsed >= seconds;
      }
      case 'all_bots_ready':
        return metrics.botCount > 0 && metrics.readyBotCount >= metrics.botCount;
      case 'bot_count_below': {
        const threshold = Number(condition.params['threshold'] ?? 0);
        return metrics.botCount < threshold;
      }
      case 'tps_below': {
        const threshold = Number(condition.params['threshold'] ?? 0);
        return metrics.tps < threshold;
      }
      case 'custom_event': {
        const eventName = String(condition.params['eventName'] ?? '');
        return state.customEvents.has(eventName);
      }
      default:
        this.logger.warn(`Unknown condition type: ${condition.type}`);
        return false;
    }
  }
}
