import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
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
          title="打开菜单"
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
