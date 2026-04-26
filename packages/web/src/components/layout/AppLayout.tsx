import { useEffect, useRef, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sidebar as GlobalSidebar } from './Sidebar.js';
import { ResourceSidebar } from './ResourceSidebar.js';
import { TopStatusBar } from './TopStatusBar.js';
import { AlertBanner } from '../status/AlertBanner.js';
import { WsStatusBanner } from './WsStatusBanner.js';
import { ToastContainer } from '../ui/ToastContainer.js';
import { ConfirmDialog } from '../ui/ConfirmDialog.js';
import { useThemeStore } from '../../stores/theme.store.js';
import { applyTheme, watchSystemScheme } from '../../theme/theme-runtime.js';
import { ErrorBoundary } from '../ErrorBoundary.js';
import { Menu } from 'lucide-react';

export function AppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const mode = useThemeStore((s) => s.mode);
  const preset = useThemeStore((s) => s.preset);
  const collapsed = useThemeStore((s) => s.sidebarCollapsed);
  const floating = useThemeStore((s) => s.sidebarFloating);
  const setMobileSidebarOpen = useThemeStore((s) => s.setMobileSidebarOpen);
  const sidebarMode = useThemeStore((s) => s.sidebarMode);

  // Apply theme whenever mode or preset changes
  useEffect(() => {
    applyTheme(mode, preset);
  }, [mode, preset]);

  // Watch OS color-scheme when in system mode
  useEffect(() => {
    if (mode !== 'system') return;
    return watchSystemScheme(() => applyTheme(mode, preset));
  }, [mode, preset]);

  // Keyboard shortcuts: g+s → /resources, g+m → /monitoring, g+l → /log-center
  const pendingG = useRef(false);
  const gTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return;

      if (e.key === 'g' && !pendingG.current) {
        pendingG.current = true;
        if (gTimeout.current) clearTimeout(gTimeout.current);
        gTimeout.current = setTimeout(() => {
          pendingG.current = false;
        }, 500);
        return;
      }

      if (pendingG.current) {
        pendingG.current = false;
        if (gTimeout.current) { clearTimeout(gTimeout.current); gTimeout.current = null; }
        switch (e.key) {
          case 's': navigate('/resources'); break;
          case 'm': navigate('/monitoring'); break;
          case 'l': navigate('/log-center'); break;
        }
      }
    },
    [navigate],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (gTimeout.current) clearTimeout(gTimeout.current);
    };
  }, [handleKeyDown]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200">
      {sidebarMode === 'global' ? <GlobalSidebar /> : <ResourceSidebar />}
      <main
        className={`flex-1 overflow-auto flex flex-col transition-all duration-200 ${
          floating ? 'md:ml-20' : (collapsed ? 'md:ml-20' : 'md:ml-60')
        }`}
      >
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="md:hidden fixed top-4 left-4 z-20 p-2.5 bg-white/70 dark:bg-gray-900/60 text-primary-900 dark:text-primary-100 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xl backdrop-blur-lg"
          title={t('sidebar.openMenu')}
        >
          <Menu size={20} />
        </button>
        <TopStatusBar />
        <AlertBanner />
        <WsStatusBanner />
        <div className="flex-1 overflow-auto">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
      <ToastContainer />
      <ConfirmDialog />
    </div>
  );
}
