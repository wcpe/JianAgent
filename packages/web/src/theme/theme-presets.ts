/** Theme preset identifiers. */
export type ThemePreset = 'default' | 'ocean' | 'emerald';

/** Preset metadata for UI pickers. */
export const THEME_PRESETS: readonly {
  id: ThemePreset;
  label: string;
}[] = [
  { id: 'default', label: 'Default' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'emerald', label: 'Emerald' },
] as const;
