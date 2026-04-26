import { create } from 'zustand';
import type { ThemePreset } from '../theme/theme-presets.js';
import type { ResourceDetailDto } from '@jian-agent/shared-domain';
import { DEFAULT_NAV_ORDER } from '../components/layout/nav-config.js';

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
  legacy: 'jianagent-theme',
  sidebar: 'jianagent-sidebar-collapsed',
  navGroups: 'jianagent-nav-groups-collapsed',
  navOrder: 'jianagent-nav-order',
  navItemOrder: 'jianagent-nav-item-order',
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

function hydrateCollapsedGroups(): Record<string, boolean> {
  const stored = readStored(STORAGE_KEYS.navGroups);
  if (!stored) return {};
  try { return JSON.parse(stored); } catch { return {}; }
}

function hydrateNavOrder(): readonly string[] {
  const stored = readStored(STORAGE_KEYS.navOrder);
  if (!stored) return DEFAULT_NAV_ORDER;
  try {
    const parsed = JSON.parse(stored) as string[];
    const defaultSet = new Set(DEFAULT_NAV_ORDER);
    if (parsed.length !== DEFAULT_NAV_ORDER.length || !parsed.every((id) => defaultSet.has(id))) return DEFAULT_NAV_ORDER;
    return parsed;
  } catch { return DEFAULT_NAV_ORDER; }
}

function hydrateNavItemOrder(): Readonly<Record<string, readonly string[]>> {
  const stored = readStored(STORAGE_KEYS.navItemOrder);
  if (!stored) return {};
  try { return JSON.parse(stored); } catch { return {}; }
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
  readonly collapsedGroups: Record<string, boolean>;
  readonly navGroupOrder: readonly string[];
  readonly navItemOrder: Readonly<Record<string, readonly string[]>>;

  /** Cycle light → dark → system → light. */
  cycleMode: () => void;
  setMode: (mode: ThemeMode) => void;
  setPreset: (preset: ThemePreset) => void;
  toggleSidebar: () => void;
  toggleSidebarFloating: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setSidebarMode: (mode: 'global' | 'resource', props?: ResourceSidebarProps | null) => void;
  toggleNavGroup: (groupId: string) => void;
  setNavGroupOrder: (order: string[]) => void;
  setNavItemOrder: (groupId: string, paths: string[]) => void;
  resetNavGroupOrder: () => void;
  clearAllCache: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: hydrateMode(),
  preset: hydratePreset(),
  sidebarCollapsed: hydrateSidebar(),
  sidebarFloating: hydrateSidebarFloating(),
  mobileSidebarOpen: false,

  sidebarMode: 'global',
  resourceSidebarProps: null,
  collapsedGroups: hydrateCollapsedGroups(),
  navGroupOrder: hydrateNavOrder(),
  navItemOrder: hydrateNavItemOrder(),

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

  toggleNavGroup: (groupId) =>
    set((state) => {
      const next = { ...state.collapsedGroups, [groupId]: !state.collapsedGroups[groupId] };
      localStorage.setItem(STORAGE_KEYS.navGroups, JSON.stringify(next));
      return { collapsedGroups: next };
    }),

  setNavGroupOrder: (order) => {
    localStorage.setItem(STORAGE_KEYS.navOrder, JSON.stringify(order));
    set({ navGroupOrder: order });
  },

  setNavItemOrder: (groupId, paths) =>
    set((state) => {
      const next = { ...state.navItemOrder, [groupId]: paths };
      localStorage.setItem(STORAGE_KEYS.navItemOrder, JSON.stringify(next));
      return { navItemOrder: next };
    }),

  resetNavGroupOrder: () => {
    localStorage.removeItem(STORAGE_KEYS.navOrder);
    localStorage.removeItem(STORAGE_KEYS.navItemOrder);
    set({ navGroupOrder: DEFAULT_NAV_ORDER, navItemOrder: {} });
  },

  clearAllCache: () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      localStorage.removeItem(key);
    }
    localStorage.removeItem(STORAGE_KEYS.sidebar + '_floating');
  },
}));
