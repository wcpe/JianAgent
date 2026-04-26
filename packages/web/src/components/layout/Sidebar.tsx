import { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  PanelLeftClose, PanelLeft, LogOut, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store.js';
import { useThemeStore } from '../../stores/theme.store.js';
import { ThemeToggle } from './ThemeToggle.js';
import { NAV_GROUPS, getOrderedNavGroups, getOrderedItems } from './nav-config.js';
import { alertsApi } from '../../features/alerts/alerts.api.js';
import { useWsChannel } from '../../ws/use-ws-channel.js';

export function Sidebar() {
  const { t } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const collapsed = useThemeStore((s) => s.sidebarCollapsed);
  const floating = useThemeStore((s) => s.sidebarFloating);
  const toggleSidebar = useThemeStore((s) => s.toggleSidebar);
  const mobileSidebarOpen = useThemeStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useThemeStore((s) => s.setMobileSidebarOpen);
  const collapsedGroups = useThemeStore((s) => s.collapsedGroups);
  const toggleNavGroup = useThemeStore((s) => s.toggleNavGroup);
  const navGroupOrder = useThemeStore((s) => s.navGroupOrder);
  const setNavGroupOrder = useThemeStore((s) => s.setNavGroupOrder);
  const navItemOrder = useThemeStore((s) => s.navItemOrder);
  const setNavItemOrder = useThemeStore((s) => s.setNavItemOrder);

  const orderedGroups = getOrderedNavGroups(navGroupOrder);

  // Group drag state
  const [dragGroupId, setDragGroupId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

  // Item drag state
  const [dragItemKey, setDragItemKey] = useState<{ groupId: string; path: string } | null>(null);
  const [dragOverItemPath, setDragOverItemPath] = useState<string | null>(null);

  // Alert count badge for observability group
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    alertsApi.getSummary().then((s) => setAlertCount(s.totalActive)).catch(() => {});
  }, []);

  const handleAlertFired = useCallback(() => {
    alertsApi.getSummary().then((s) => setAlertCount(s.totalActive)).catch(() => {});
  }, []);

  useWsChannel('alert:fired', handleAlertFired);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavClick = () => {
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

  const isGroupActive = (items: readonly { path: string }[]): boolean =>
    items.some((item) => location.pathname.startsWith(item.path));

  const isCompact = collapsed && !floating;

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
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-4 min-h-[56px] border-b border-gray-200 dark:border-gray-800">
          <NavLink to="/dashboard" className={`text-lg font-bold text-gray-900 dark:text-gray-100 truncate ml-1 transition-opacity ${isCompact ? 'opacity-0 hidden' : 'opacity-100'} ${floating ? 'group-hover:block group-hover:opacity-100' : ''}`}>
            JianAgent
          </NavLink>
          <div className="hidden items-center gap-1 md:flex">
            <button
              onClick={toggleSidebar}
              className="p-1 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
            >
              {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto scrollbar-slim">
          {orderedGroups.map((group) => {
            const groupCollapsed = !!collapsedGroups[group.id];
            const groupActive = isGroupActive(group.items);

            return (
              <div
                key={group.id}
                className={`mb-1 ${dragOverGroupId === group.id && dragGroupId !== group.id ? 'border-t-2 border-primary-500' : ''}`}
                onDragOver={(e) => { if (!isCompact) { e.preventDefault(); setDragOverGroupId(group.id); } }}
                onDragLeave={() => setDragOverGroupId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverGroupId(null);
                  if (!dragGroupId || dragGroupId === group.id) return;
                  const currentOrder = [...navGroupOrder];
                  const fromIdx = currentOrder.indexOf(dragGroupId);
                  const toIdx = currentOrder.indexOf(group.id);
                  if (fromIdx < 0 || toIdx < 0) return;
                  currentOrder.splice(fromIdx, 1);
                  currentOrder.splice(toIdx, 0, dragGroupId);
                  setNavGroupOrder(currentOrder);
                  setDragGroupId(null);
                }}
              >
                {/* Group header — hidden when sidebar is compact */}
                {!isCompact && (
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragGroupId(group.id); }}
                    onDragEnd={() => { setDragGroupId(null); setDragOverGroupId(null); }}
                    onClick={() => toggleNavGroup(group.id)}
                    className={`w-full flex items-center gap-2 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors cursor-grab active:cursor-grabbing ${
                      dragGroupId === group.id ? 'opacity-50' : ''
                    } ${
                      groupActive
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                    } ${floating ? 'group-hover:flex' : ''}`}
                  >
                    <ChevronRight
                      size={12}
                      className={`shrink-0 transition-transform duration-200 ${
                        groupCollapsed ? '' : 'rotate-90'
                      }`}
                    />
                    <span className="truncate">{t(`sidebar.${group.id}`)}</span>
                    {group.id === 'observability' && alertCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{alertCount}</span>
                    )}
                  </button>
                )}

                {/* Group items */}
                <div
                  className={`grid transition-[grid-template-rows] duration-200 ${
                    !isCompact && groupCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
                  }`}
                >
                  <div className="overflow-hidden">
                    {getOrderedItems(group, navItemOrder).map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        draggable={!isCompact}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.effectAllowed = 'move';
                          setDragItemKey({ groupId: group.id, path: item.path });
                        }}
                        onDragEnd={() => { setDragItemKey(null); setDragOverItemPath(null); }}
                        onDragOver={(e) => {
                          if (!dragItemKey || dragItemKey.groupId !== group.id) return;
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverItemPath(item.path);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverItemPath(null);
                          if (!dragItemKey || dragItemKey.groupId !== group.id || dragItemKey.path === item.path) return;
                          const items = getOrderedItems(group, navItemOrder).map((i) => i.path);
                          const fromIdx = items.indexOf(dragItemKey.path);
                          const toIdx = items.indexOf(item.path);
                          if (fromIdx < 0 || toIdx < 0) return;
                          items.splice(fromIdx, 1);
                          items.splice(toIdx, 0, dragItemKey.path);
                          setNavItemOrder(group.id, items);
                          setDragItemKey(null);
                        }}
                        title={isCompact ? item.label : undefined}
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                          `mx-2 mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                            dragItemKey?.path === item.path ? 'opacity-50' : ''
                          } ${
                            dragOverItemPath === item.path && dragItemKey?.path !== item.path ? 'ring-2 ring-primary-400' : ''
                          } ${
                            isNavItemActive(item.path, isActive)
                              ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                          }`
                        }
                      >
                        <item.icon size={18} className="shrink-0" />
                        <span className={`font-medium transition-opacity truncate ${isCompact ? 'opacity-0 hidden' : 'opacity-100'} ${floating ? 'group-hover:block group-hover:opacity-100' : ''}`}>
                          {item.label}
                        </span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="py-2 border-t border-gray-200 dark:border-gray-800">
          <ThemeToggle collapsed={collapsed} floating={floating} />
          <button
            onClick={handleLogout}
            className="mx-2 mt-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-[calc(100%-1rem)]"
            title={isCompact ? t('nav.logout') : undefined}
          >
            <LogOut size={18} className="shrink-0" />
            <span className={`font-medium transition-opacity truncate ${isCompact ? 'opacity-0 hidden' : 'opacity-100'} ${floating ? 'group-hover:block group-hover:opacity-100' : ''}`}>
              {t('nav.logout')}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
