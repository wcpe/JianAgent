import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useThemeStore } from '../theme.store.js';

const mockStorage: Record<string, string> = {};

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((k: string) => mockStorage[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { mockStorage[k] = v; }),
    removeItem: vi.fn((k: string) => { delete mockStorage[k]; }),
  });
  useThemeStore.setState({ mode: 'light', preset: 'default', sidebarCollapsed: false });
  vi.clearAllMocks();
});

describe('useThemeStore', () => {
  it('cycleMode: light → dark → system → light', () => {
    const { cycleMode, mode } = useThemeStore.getState();
    expect(mode).toBe('light');
    cycleMode();
    expect(useThemeStore.getState().mode).toBe('dark');
    cycleMode();
    expect(useThemeStore.getState().mode).toBe('system');
    cycleMode();
    expect(useThemeStore.getState().mode).toBe('light');
  });

  it('setMode sets explicit mode', () => {
    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(localStorage.setItem).toHaveBeenCalledWith('jianagent-theme-mode', 'dark');
  });

  it('setPreset stores preset', () => {
    useThemeStore.getState().setPreset('ocean');
    expect(useThemeStore.getState().preset).toBe('ocean');
    expect(localStorage.setItem).toHaveBeenCalledWith('jianagent-theme-preset', 'ocean');
  });

  it('toggleSidebar flips collapsed state', () => {
    expect(useThemeStore.getState().sidebarCollapsed).toBe(false);
    useThemeStore.getState().toggleSidebar();
    expect(useThemeStore.getState().sidebarCollapsed).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith('jianagent-sidebar-collapsed', 'true');
  });

  it('toggleSidebar back to uncollapsed', () => {
    useThemeStore.setState({ sidebarCollapsed: true });
    useThemeStore.getState().toggleSidebar();
    expect(useThemeStore.getState().sidebarCollapsed).toBe(false);
  });

  it('setMobileSidebarOpen updates state', () => {
    expect(useThemeStore.getState().mobileSidebarOpen).toBe(false);
    useThemeStore.getState().setMobileSidebarOpen(true);
    expect(useThemeStore.getState().mobileSidebarOpen).toBe(true);
    useThemeStore.getState().setMobileSidebarOpen(false);
    expect(useThemeStore.getState().mobileSidebarOpen).toBe(false);
  });

  it('cycleMode persists to localStorage each step', () => {
    useThemeStore.getState().cycleMode();
    expect(localStorage.setItem).toHaveBeenCalledWith('jianagent-theme-mode', 'dark');
    useThemeStore.getState().cycleMode();
    expect(localStorage.setItem).toHaveBeenCalledWith('jianagent-theme-mode', 'system');
    useThemeStore.getState().cycleMode();
    expect(localStorage.setItem).toHaveBeenCalledWith('jianagent-theme-mode', 'light');
  });

  it('toggleNavGroup collapses and expands a group', () => {
    expect(useThemeStore.getState().collapsedGroups).toEqual({});
    useThemeStore.getState().toggleNavGroup('resources');
    expect(useThemeStore.getState().collapsedGroups.resources).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'jianagent-nav-groups-collapsed',
      expect.stringContaining('"resources":true'),
    );
    useThemeStore.getState().toggleNavGroup('resources');
    expect(useThemeStore.getState().collapsedGroups.resources).toBe(false);
  });

  it('toggleNavGroup handles multiple groups independently', () => {
    useThemeStore.getState().toggleNavGroup('resources');
    useThemeStore.getState().toggleNavGroup('admin');
    const groups = useThemeStore.getState().collapsedGroups;
    expect(groups.resources).toBe(true);
    expect(groups.admin).toBe(true);
    useThemeStore.getState().toggleNavGroup('resources');
    expect(useThemeStore.getState().collapsedGroups.resources).toBe(false);
    expect(useThemeStore.getState().collapsedGroups.admin).toBe(true);
  });
});
