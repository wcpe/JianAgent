/**
 * Unified theme runtime — resolves mode + preset into final
 * DOM attributes on `document.documentElement`.
 *
 * - `.dark` class: added when the *resolved* color scheme is dark.
 * - `data-theme` attribute: set to the active preset id.
 */

import type { ThemeMode } from '../stores/theme.store.js';
import type { ThemePreset } from './theme-presets.js';

/** Resolve the effective color scheme, following OS preference when mode is `system`. */
function resolveEffectiveScheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return 'light';
  }
  return mode;
}

/** Apply theme to the document root. Call this on every mode / preset change. */
export function applyTheme(mode: ThemeMode, preset: ThemePreset): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const effective = resolveEffectiveScheme(mode);

  // Toggle dark class
  if (effective === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Set preset data attribute
  root.setAttribute('data-theme', preset);
}

/**
 * Start watching OS color-scheme changes. Returns an unsubscribe function.
 * Only needed when mode === 'system'.
 */
export function watchSystemScheme(
  onChange: () => void,
): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => onChange();
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
