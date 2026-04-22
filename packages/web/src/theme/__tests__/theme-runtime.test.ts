import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyTheme, watchSystemScheme } from '../theme-runtime.js';

/** Minimal DOM mock for documentElement */
function createRoot() {
  const classes = new Set<string>();
  const attrs: Record<string, string> = {};
  return {
    classList: {
      add: (c: string) => { classes.add(c); },
      remove: (c: string) => { classes.delete(c); },
      contains: (c: string) => classes.has(c),
    },
    setAttribute: (k: string, v: string) => { attrs[k] = v; },
    getAttribute: (k: string) => attrs[k] ?? null,
    _classes: classes,
    _attrs: attrs,
  };
}

let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  root = createRoot();
  vi.stubGlobal('document', {
    documentElement: root,
  } as unknown as Document);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('applyTheme', () => {
  it('sets data-theme attribute to the preset id', () => {
    applyTheme('light', 'ocean');
    expect(root._attrs['data-theme']).toBe('ocean');
  });

  it('adds .dark class when mode is dark', () => {
    applyTheme('dark', 'default');
    expect(root._classes.has('dark')).toBe(true);
  });

  it('removes .dark class when mode is light', () => {
    applyTheme('dark', 'default');
    expect(root._classes.has('dark')).toBe(true);
    applyTheme('light', 'default');
    expect(root._classes.has('dark')).toBe(false);
  });

  it('switches preset on subsequent calls', () => {
    applyTheme('light', 'default');
    expect(root._attrs['data-theme']).toBe('default');
    applyTheme('light', 'emerald');
    expect(root._attrs['data-theme']).toBe('emerald');
  });

  it('system mode resolves to light when no matchMedia', () => {
    // No matchMedia available — should default to light
    applyTheme('system', 'default');
    expect(root._classes.has('dark')).toBe(false);
  });

  it('system mode resolves to dark when prefers-color-scheme is dark', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: true }),
    } as unknown as Window);
    applyTheme('system', 'default');
    expect(root._classes.has('dark')).toBe(true);
  });

  it('system mode resolves to light when prefers-color-scheme is light', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
    } as unknown as Window);
    applyTheme('system', 'ocean');
    expect(root._classes.has('dark')).toBe(false);
    expect(root._attrs['data-theme']).toBe('ocean');
  });

  it('no-ops when document is undefined (SSR)', () => {
    vi.stubGlobal('document', undefined);
    // Should not throw
    expect(() => applyTheme('dark', 'emerald')).not.toThrow();
  });
});

describe('watchSystemScheme', () => {
  it('returns unsubscribe function', () => {
    const mockRemove = vi.fn();
    vi.stubGlobal('window', {
      matchMedia: () => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: mockRemove,
      }),
    } as unknown as Window);

    const handler = vi.fn();
    const unsub = watchSystemScheme(handler);
    expect(typeof unsub).toBe('function');
    unsub();
    expect(mockRemove).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('calls onChange when system scheme changes', () => {
    let listener: (() => void) | null = null;
    vi.stubGlobal('window', {
      matchMedia: () => ({
        matches: false,
        addEventListener: (_evt: string, fn: () => void) => { listener = fn; },
        removeEventListener: vi.fn(),
      }),
    } as unknown as Window);

    const handler = vi.fn();
    watchSystemScheme(handler);

    expect(listener).not.toBeNull();
    listener!();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('returns no-op when window is undefined (SSR)', () => {
    vi.stubGlobal('window', undefined);
    const unsub = watchSystemScheme(vi.fn());
    expect(typeof unsub).toBe('function');
    // Should not throw on call
    unsub();
  });
});
