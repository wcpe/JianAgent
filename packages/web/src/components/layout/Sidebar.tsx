import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Server, TerminalSquare, Bot, FlaskConical,
  Activity, FileText, GitCompare, Stethoscope, ScrollText,
  Bell, BellRing, Shield, PanelLeftClose, PanelLeft, LogOut, MonitorCheck, Users, FileCode,
  Radar,
  Globe,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store.js';
import { useThemeStore } from '../../stores/theme.store.js';
import { ThemeToggle } from './ThemeToggle.js';

interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

const NAV_ITEMS: readonly NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/resources', label: '资源工作台', icon: Server },
  { path: '/server-templates', label: '启动模板', icon: FileCode },
  { path: '/terminals', label: '终端', icon: TerminalSquare },
  { path: '/node-log', label: 'Node Log', icon: ScrollText },
  { path: '/bots', label: '机器人工作台', icon: Bot },
  { path: '/validation', label: '验证中心', icon: FlaskConical },
  { path: '/local-validation', label: '本地验证运行台', icon: FlaskConical },
  { path: '/sessions', label: '压测会话', icon: Activity },
  { path: '/session-templates', label: '会话模板', icon: FileText },
  { path: '/sessions/compare', label: '会话对比', icon: GitCompare },
  { path: '/monitoring', label: '服务器监控', icon: MonitorCheck },
  { path: '/population', label: '在线人数', icon: Users },
  { path: '/diagnostics', label: '诊断', icon: Stethoscope },
  { path: '/logs', label: '日志', icon: ScrollText },
  { path: '/log-center', label: '日志中心', icon: Search },
  { path: '/alerts', label: '告警', icon: Bell },
  { path: '/notifications', label: '通知渠道', icon: BellRing },
  { path: '/jvm-observability', label: 'JVM 可观测', icon: Radar },
  { path: '/audit', label: '审计', icon: Shield },
  { path: '/governance', label: '治理中心', icon: ShieldCheck },
];

export function Sidebar() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const collapsed = useThemeStore((s) => s.sidebarCollapsed);
  const floating = useThemeStore((s) => s.sidebarFloating);
  const toggleSidebar = useThemeStore((s) => s.toggleSidebar);
  const toggleFloating = useThemeStore((s) => s.toggleSidebarFloating);
  const mobileSidebarOpen = useThemeStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useThemeStore((s) => s.setMobileSidebarOpen);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavClick = () => {
    // Auto-close sidebar on mobile after navigation
    setMobileSidebarOpen(false);
  };

  const isNavItemActive = (itemPath: string, isActive: boolean): boolean => {
    if (itemPath === '/sessions') {
      const pathname = location.pathname;
      if (pathname === '/sessions' || pathname === '/sessions/new') {
        return true;
      }
      return /^\/sessions\/[^/]+$/.test(pathname) && pathname !== '/sessions/compare';
    }
    return isActive;
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
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
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-4 min-h-[56px] border-b border-gray-200 dark:border-gray-800">
        <span className={`text-lg font-bold text-gray-900 dark:text-gray-100 truncate ml-1 transition-opacity ${collapsed && !floating ? 'opacity-0 hidden' : 'opacity-100'} ${floating ? 'group-hover:block group-hover:opacity-100' : ''}`}>
          JianAgent
        </span>
        <div className="hidden items-center gap-1 md:flex">
          <button
            onClick={toggleSidebar}
            className="p-1 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={collapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button
            onClick={toggleFloating}
            className="p-1 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={floating ? '固定侧边栏' : '悬浮侧边栏'}
          >
            {floating ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto scrollbar-slim">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={collapsed && !floating ? item.label : undefined}
            onClick={handleNavClick}
            className={({ isActive }) =>
              `mx-2 mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                isNavItemActive(item.path, isActive)
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
              }`
            }
          >
            <item.icon size={18} className="shrink-0" />
            <span className={`font-medium transition-opacity truncate ${collapsed && !floating ? 'opacity-0 hidden' : 'opacity-100'} ${floating ? 'group-hover:block group-hover:opacity-100' : ''}`}>
              {item.label}
            </span>
          </NavLink>
        ))}
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
