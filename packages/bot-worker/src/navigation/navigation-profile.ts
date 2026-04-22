export type DeterminismLevel = 'strict' | 'balanced' | 'organic';

export interface NavigationExecutionProfile {
  readonly navigationProfile: string;
  readonly scenarioProfile: string;
  readonly determinismLevel: DeterminismLevel;
}

export function resolveExecutionProfile(
  params: Readonly<Record<string, unknown>>,
): NavigationExecutionProfile {
  const determinism = params.determinismLevel;
  return {
    navigationProfile:
      typeof params.navigationProfile === 'string' && params.navigationProfile.trim()
        ? params.navigationProfile
        : 'pathfinder-balanced',
    scenarioProfile:
      typeof params.scenarioProfile === 'string' && params.scenarioProfile.trim()
        ? params.scenarioProfile
        : 'default',
    determinismLevel:
      determinism === 'strict' || determinism === 'organic' ? determinism : 'balanced',
  };
}

export function resolveGoalRadius(profile: NavigationExecutionProfile): number {
  if (profile.navigationProfile.includes('strict') || profile.determinismLevel === 'strict') {
    return 1;
  }
  if (profile.navigationProfile.includes('organic') || profile.determinismLevel === 'organic') {
    return 2.5;
  }
  return 1.5;
}

export function buildDeterministicOffset(
  seedInput: string,
  step: number,
  radius: number,
  determinismLevel: DeterminismLevel,
): { readonly x: number; readonly z: number } {
  const seed = hashSeed(`${seedInput}:${step}:${determinismLevel}`);
  const angle = normalized(seed ^ 0x9e3779b9) * Math.PI * 2;
  const distanceFactor =
    determinismLevel === 'strict'
      ? 0.6
      : determinismLevel === 'organic'
        ? 0.95
        : 0.8;
  const distance = Math.max(2, radius * distanceFactor);
  return {
    x: Math.cos(angle) * distance,
    z: Math.sin(angle) * distance,
  };
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalized(seed: number): number {
  return (seed % 10_000) / 10_000;
}
