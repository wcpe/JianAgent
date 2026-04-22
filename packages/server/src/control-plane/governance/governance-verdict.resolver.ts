import { Injectable } from '@nestjs/common';
import type {
  ValidationVerdict,
  GovernanceAction,
} from './governance.service.js';

export interface VerdictAnalysis {
  verdict: ValidationVerdict;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  suggestedAction: GovernanceAction;
  confidence: number;
  factors: VerdictFactor[];
}

export interface VerdictFactor {
  name: string;
  weight: number;
  value: number;
  description: string;
}

@Injectable()
export class GovernanceVerdictResolver {
  private readonly riskThresholds = {
    low: 0.8,
    medium: 0.6,
    high: 0.4,
    critical: 0.2,
  };

  /**
   * Analyze a validation verdict and produce a structured analysis.
   */
  analyze(verdict: ValidationVerdict): VerdictAnalysis {
    const factors = this.extractFactors(verdict);
    const riskLevel = this.computeRiskLevel(verdict.score, factors);
    const suggestedAction = this.suggestAction(verdict, riskLevel);
    const confidence = this.computeConfidence(factors);

    return {
      verdict,
      riskLevel,
      suggestedAction,
      confidence,
      factors,
    };
  }

  /**
   * Extract decision factors from the verdict.
   */
  private extractFactors(verdict: ValidationVerdict): VerdictFactor[] {
    const factors: VerdictFactor[] = [];

    // Score factor
    factors.push({
      name: 'validation_score',
      weight: 0.4,
      value: verdict.score,
      description: `Overall validation score: ${(verdict.score * 100).toFixed(1)}%`,
    });

    // Pass/fail factor
    factors.push({
      name: 'pass_status',
      weight: 0.3,
      value: verdict.passed ? 1.0 : 0.0,
      description: verdict.passed
        ? 'Validation passed all checks'
        : 'Validation failed one or more checks',
    });

    // Anomaly factor (inverse - fewer anomalies = higher value)
    const anomalyScore = Math.max(0, 1 - verdict.anomalies.length * 0.2);
    factors.push({
      name: 'anomaly_count',
      weight: 0.2,
      value: anomalyScore,
      description: `${verdict.anomalies.length} anomalies detected`,
    });

    // Recommendation factor
    const recommendationScore =
      verdict.recommendations.length === 0
        ? 1.0
        : Math.max(0, 1 - verdict.recommendations.length * 0.15);
    factors.push({
      name: 'recommendations',
      weight: 0.1,
      value: recommendationScore,
      description: `${verdict.recommendations.length} recommendations`,
    });

    return factors;
  }

  /**
   * Compute risk level based on score and factors.
   */
  private computeRiskLevel(
    score: number,
    factors: VerdictFactor[],
  ): 'low' | 'medium' | 'high' | 'critical' {
    const weightedScore = factors.reduce(
      (sum, f) => sum + f.weight * f.value,
      0,
    );

    if (weightedScore >= this.riskThresholds.low) return 'low';
    if (weightedScore >= this.riskThresholds.medium) return 'medium';
    if (weightedScore >= this.riskThresholds.high) return 'high';
    return 'critical';
  }

  /**
   * Suggest a governance action based on verdict and risk level.
   */
  private suggestAction(
    verdict: ValidationVerdict,
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
  ): GovernanceAction {
    if (riskLevel === 'low' && verdict.passed) {
      return 'approve';
    }

    if (riskLevel === 'critical' || (!verdict.passed && verdict.score < 0.3)) {
      return 'rollback';
    }

    if (riskLevel === 'high') {
      return verdict.anomalies.length > 2 ? 'reject' : 'escalate';
    }

    if (riskLevel === 'medium') {
      return verdict.anomalies.length > 0 ? 'escalate' : 'approve';
    }

    return 'retry';
  }

  /**
   * Compute confidence in the analysis based on factor consistency.
   */
  private computeConfidence(factors: VerdictFactor[]): number {
    if (factors.length === 0) return 0;

    const values = factors.map((f) => f.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;

    // Lower variance = higher confidence
    const normalizedVariance = Math.min(1, variance * 4);
    return Math.max(0, 1 - normalizedVariance);
  }
}
