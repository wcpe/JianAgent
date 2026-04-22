export const JavaRuntimeSource = {
  SYSTEM: 'system',
  DISCOVERED: 'discovered',
  MANUAL: 'manual',
} as const;

export type JavaRuntimeSource = (typeof JavaRuntimeSource)[keyof typeof JavaRuntimeSource];
