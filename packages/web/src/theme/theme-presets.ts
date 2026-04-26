/** Theme preset identifiers. */
export type ThemePreset = 'default' | 'ocean' | 'emerald';

/** Preset metadata for UI pickers. */
export const THEME_PRESETS: readonly {
  id: ThemePreset;
  label: string;
}[] = [
  { id: 'default', label: '默认' },
  { id: 'ocean', label: '海洋' },
  { id: 'emerald', label: '翡翠' },
] as const;
