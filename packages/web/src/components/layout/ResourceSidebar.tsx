import { NavLink, useNavigate, useParams, useLocation } from 'react-router-dom';
import { PanelLeftClose, PanelLeft, LogOut, ChevronLeft } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store.js';
import { useThemeStore } from '../../stores/theme.store.js';
import { ThemeToggle } from './ThemeToggle.js';
import { getVisibleTabs } from '../../features/resource-detail/resource-tab-registry.js';

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  degraded: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  unknown: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const HEALTH_LABELS: Record<string, string> = {
  healthy: '健康',
  degraded: '降级',
  critical: '严重',
  unknown: '未知',
};

export function ResourceSidebar() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  
  const collapsed = useThemeStore((s) => s.sidebarCollapsed);
  const floating = useThemeStore((s) => s.sidebarFloating);
  const toggleSidebar = useThemeStore((s) => s.toggleSidebar);
  const toggleFloating = useThemeStore((s) => s.toggleSidebarFloating);
  const mobileSidebarOpen = useThemeStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useThemeStore((s) => s.setMobileSidebarOpen);
  const props = useThemeStore((s) => s.resourceSidebarProps);

  if (!props || !props.detail || !id) return null;

  const { detail, backTo = '/resources', backLabel = '返回资源工作台' } = props;
  const visibleTabs = getVisibleTabs(detail);
  
  const healthClass = HEALTH_COLORS[detail.status.health] ?? HEALTH_COLORS.unknown;
  const healthLabel = HEALTH_LABELS[detail.status.health] ?? detail.status.health;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavClick = () => {
    setMobileSidebarOpen(false);
  };

  // Base path for links (e.g. /servers/123)
  const basePath = location.pathname.replace(new RegExp(`/${id}/.*$`), `/${id}`);

  return (
    <>
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-3 left-3 bottom-3 h-auto rounded-2xl flex flex-col transition-all duration-200 z-[40] bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200 dark:border-gray-800 shadow-xl ${
          collapsed ? 'w-16' : 'w-56'
        } ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 group ${
          floating ? 'hover:w-56 hover:shadow-2xl' : ''
        }`}
      >
        {/* Header & Back Button */}
        <div className="flex flex-col px-3 py-4 border-b border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            {!collapsed || floating ? (
              <button
                onClick={() => navigate(backTo)}
                className={`flex items-center text-xs text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 transition-colors ${collapsed && !floating ? 'opacity-0 hidden' : 'opacity-100'} ${floating ? 'group-hover:block group-hover:opacity-100' : ''}`}
              >
                <ChevronLeft size={14} className="mr-0.5" />
                {backLabel}
              </button>
            ) : (
              <button onClick={() => navigate(backTo)} className="text-gray-500 mx-auto" title={backLabel}>
                <ChevronLeft size={18} />
              </button>
            )}
            <button
              onClick={toggleFloating}
              className="p-1 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors hidden md:block"
              title={floating ? '固定侧边栏' : '悬浮侧边栏'}
            >
              {floating ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>

          <div className={`flex flex-col gap-1.5 mt-1 transition-opacity ${collapsed && !floating ? 'opacity-0 hidden' : 'opacity-100'} ${floating ? 'group-hover:flex group-hover:opacity-100' : ''}`}>
              <h2 className="font-bold text-sm text-gray-900 dark:text-white truncate" title={detail.name}>
                {detail.name}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${healthClass}`}>
                  {healthLabel}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 px-1 py-0.5 rounded truncate max-w-[80px]">
                  {detail.kind}
                </span>
              </div>
            </div>
        </div>

        {/* Nav Tabs */}
        <nav className="flex-1 py-2 overflow-y-auto scrollbar-slim">
          {visibleTabs.map((t) => {
            const toPath = `${basePath}/${t.slug}`;
            const Icon = t.icon;
            return (
              <NavLink
                key={t.id}
                to={toPath}
                title={collapsed && !floating ? t.label : undefined}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `mx-2 mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    isActive || (t.slug === 'overview' && location.pathname === basePath)
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                  }`
                }
              >
                <Icon size={18} className="shrink-0" />
                <span className={`font-medium truncate transition-opacity ${collapsed && !floating ? 'opacity-0 hidden' : 'opacity-100'} ${floating ? 'group-hover:block group-hover:opacity-100' : ''}`}>
                  {t.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="py-2 border-t border-gray-200 dark:border-gray-800">
          <ThemeToggle collapsed={collapsed} floating={floating} />
          <button
            onClick={handleLogout}
            className="mx-2 mt-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-[calc(100%-1rem)]"
            title={collapsed && !floating ? '退出登录' : undefined}
          >
            <LogOut size={18} className="shrink-0" />
            <span className={`font-medium transition-opacity truncate ${collapsed && !floating ? 'opacity-0 hidden' : 'opacity-100'} ${floating ? 'group-hover:block group-hover:opacity-100' : ''}`}>
              退出登录
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
