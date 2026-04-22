import { Sun, Moon, Monitor, Palette } from 'lucide-react';
import { useThemeStore } from '../../stores/theme.store.js';
import { THEME_PRESETS } from '../../theme/theme-presets.js';

const MODE_ICONS = {
  light: Moon,
  dark: Sun,
  system: Monitor,
} as const;

const MODE_LABELS = {
  light: '暗色模式',
  dark: '系统模式',
  system: '亮色模式',
} as const;

export function ThemeToggle({ collapsed, floating = false }: { readonly collapsed: boolean; readonly floating?: boolean }) {
  const mode = useThemeStore((s) => s.mode);
  const cycleMode = useThemeStore((s) => s.cycleMode);
  
  const preset = useThemeStore((s) => s.preset);
  const setPreset = useThemeStore((s) => s.setPreset);

  const Icon = MODE_ICONS[mode];
  const label = MODE_LABELS[mode];

  const cyclePreset = () => {
    const currentIndex = THEME_PRESETS.findIndex(p => p.id === preset);
    const nextIndex = (currentIndex + 1) % THEME_PRESETS.length;
    setPreset(THEME_PRESETS[nextIndex].id);
  };

  const presetLabel = THEME_PRESETS.find(p => p.id === preset)?.label || preset;

  return (
    <div className="flex flex-col gap-1 w-full">
      <button
        onClick={cycleMode}
        className="mx-2 flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-[calc(100%-1rem)]"
        title={collapsed && !floating ? label : undefined}
      >
        <Icon size={18} className="shrink-0" />
        <span className={`transition-opacity truncate ${collapsed && !floating ? 'opacity-0 hidden' : 'opacity-100'} ${floating ? 'group-hover:block group-hover:opacity-100' : ''}`}>
          {label}
        </span>
      </button>

      <button
        onClick={cyclePreset}
        className="mx-2 flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-[calc(100%-1rem)]"
        title={collapsed && !floating ? `主题: ${presetLabel}` : undefined}
      >
        <Palette size={18} className="shrink-0" />
        <span className={`transition-opacity truncate ${collapsed && !floating ? 'opacity-0 hidden' : 'opacity-100'} ${floating ? 'group-hover:block group-hover:opacity-100' : ''}`}>
          主题: {presetLabel}
        </span>
      </button>
    </div>
  );
}
