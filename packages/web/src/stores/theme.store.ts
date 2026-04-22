import { create } from 'zustand';
import type { ThemePreset } from '../theme/theme-presets.js';
import type { ResourceDetailDto } from '@jian-agent/shared-domain';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ResourceSidebarProps {
  detail: ResourceDetailDto;
  resourceId: string;
  backTo?: string;
  backLabel?: string;
}

const STORAGE_KEYS = {
  mode: 'jianagent-theme-mode',
  preset: 'jianagent-theme-preset',
  // backward-compat with old key
  legacy: 'jianagent-theme',
  sidebar: 'jianagent-sidebar-collapsed',
} as const;

const VALID_MODES = new Set<ThemeMode>(['light', 'dark', 'system']);
const VALID_PRESETS = new Set<ThemePreset>(['default', 'ocean', 'emerald']);

// ---------- hydrate helpers ----------

function readStored(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
}

function hydrateMode(): ThemeMode {
  // New key first
  const stored = readStored(STORAGE_KEYS.mode);
  if (stored && VALID_MODES.has(stored as ThemeMode)) return stored as ThemeMode;
  // Legacy key: 'jianagent-theme' held 'light' | 'dark'
  const legacy = readStored(STORAGE_KEYS.legacy);
  if (legacy === 'dark' || legacy === 'light') return legacy;
  return 'light';
}

function hydratePreset(): ThemePreset {
  const stored = readStored(STORAGE_KEYS.preset);
  if (stored && VALID_PRESETS.has(stored as ThemePreset)) return stored as ThemePreset;
  return 'default';
}

function hydrateSidebar(): boolean {
  if (typeof window === 'undefined') return false;
  return readStored(STORAGE_KEYS.sidebar) === 'true';
}

function hydrateSidebarFloating(): boolean {
  return readStored(STORAGE_KEYS.sidebar + '_floating') === 'true';
}

// ---------- store ----------

export interface ThemeState {
  readonly mode: ThemeMode;
  readonly preset: ThemePreset;
  readonly sidebarCollapsed: boolean;
  readonly sidebarFloating: boolean; // Controls whether sidebar overlays content (floating) or pushes it
  readonly mobileSidebarOpen: boolean;

  readonly sidebarMode: 'global' | 'resource';
  readonly resourceSidebarProps: ResourceSidebarProps | null;

  /** Cycle light → dark → system → light. */
  cycleMode: () => void;
  setMode: (mode: ThemeMode) => void;
  setPreset: (preset: ThemePreset) => void;
  toggleSidebar: () => void;
  toggleSidebarFloating: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setSidebarMode: (mode: 'global' | 'resource', props?: ResourceSidebarProps | null) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: hydrateMode(),
  preset: hydratePreset(),
  sidebarCollapsed: hydrateSidebar(),
  sidebarFloating: hydrateSidebarFloating(),
  mobileSidebarOpen: false,

  sidebarMode: 'global',
  resourceSidebarProps: null,

  cycleMode: () =>
    set((state) => {
      const order: ThemeMode[] = ['light', 'dark', 'system'];
      const next = order[(order.indexOf(state.mode) + 1) % order.length];
      localStorage.setItem(STORAGE_KEYS.mode, next);
      return { mode: next };
    }),

  setMode: (mode) => {
    localStorage.setItem(STORAGE_KEYS.mode, mode);
    set({ mode });
  },

  setPreset: (preset) => {
    localStorage.setItem(STORAGE_KEYS.preset, preset);
    set({ preset });
  },

  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarCollapsed;
      localStorage.setItem(STORAGE_KEYS.sidebar, String(next));
      return { sidebarCollapsed: next };
    }),

  toggleSidebarFloating: () =>
    set((state) => {
      const next = !state.sidebarFloating;
      localStorage.setItem(STORAGE_KEYS.sidebar + '_floating', String(next));
      return { sidebarFloating: next };
    }),

  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem(STORAGE_KEYS.sidebar, String(collapsed));
    set({ sidebarCollapsed: collapsed });
  },

  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),

  setSidebarMode: (mode, props = null) =>
    set({ sidebarMode: mode, resourceSidebarProps: props }),
}));
