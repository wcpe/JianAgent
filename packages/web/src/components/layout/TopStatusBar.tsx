import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Wifi, WifiOff, Server, Bot, Search, Globe, X } from 'lucide-react';
import { wsClient } from '../../ws/ws-client.js';
import { useServerStore } from '../../stores/server.store.js';
import { botApi } from '../../api/bot.api.js';
import { SEARCH_ROUTES } from './nav-config.js';

const LANGUAGES = [
  { code: 'zh-CN', label: '中文' },
] as const;

type WsState = 'connected' | 'disconnected' | 'reconnecting';

export function TopStatusBar() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const servers = useServerStore((s) => s.servers);
  const [wsState, setWsState] = useState<WsState>('disconnected');
  const [workerCount, setWorkerCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [langOpen, setLangOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Poll WS status
  useEffect(() => {
    const id = setInterval(() => {
      if (wsClient.connected) setWsState('connected');
      else if (wsClient.reconnecting) setWsState('reconnecting');
      else setWsState('disconnected');
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch bot stats for worker count
  useEffect(() => {
    const fetchWorkers = () => {
      botApi.stats().then((res) => {
        const data = 'data' in res ? (res as any).data : res;
        setWorkerCount(data?.total ?? 0);
      }).catch(() => {});
    };
    fetchWorkers();
    const id = setInterval(fetchWorkers, 10_000);
    return () => clearInterval(id);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);

  // Keyboard shortcut: Ctrl+K to toggle search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filteredRoutes = searchQuery.trim()
    ? SEARCH_ROUTES.filter((r) => {
        const q = searchQuery.toLowerCase();
        return r.label.toLowerCase().includes(q) || r.path.toLowerCase().includes(q);
      })
    : SEARCH_ROUTES;

  const handleSelect = useCallback(
    (path: string) => {
      navigate(path);
      setSearchOpen(false);
      setSearchQuery('');
    },
    [navigate],
  );

  const handleLanguage = useCallback(
    (code: string) => {
      i18n.changeLanguage(code);
      localStorage.setItem('language', code);
      setLangOpen(false);
    },
    [i18n],
  );

  const connectedServers = servers.filter((s) => s.runtimeStatus === 'running').length;

  const wsColor =
    wsState === 'connected'
      ? 'text-success-500'
      : wsState === 'reconnecting'
        ? 'text-warning-500'
        : 'text-danger-500';

  const wsLabel =
    wsState === 'connected'
      ? t('topbar.wsConnected')
      : wsState === 'reconnecting'
        ? t('topbar.wsReconnecting')
        : t('topbar.wsDisconnected');

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 text-xs shrink-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 z-10 sticky top-0">
        {/* Left: Status indicators */}
        <div className="flex items-center gap-4 ml-12 md:ml-0">
          {/* WS Status */}
          <div className="flex items-center gap-1.5" title={wsLabel}>
            {wsState === 'connected' ? (
              <Wifi size={13} className={wsColor} />
            ) : (
              <WifiOff size={13} className={wsColor} />
            )}
            <span className={`font-medium ${wsColor}`}>{wsLabel}</span>
          </div>

          {/* Server count */}
          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <Server size={13} />
            <span>{t('topbar.servers')}: {connectedServers}/{servers.length}</span>
          </div>

          {/* Bot/Worker count */}
          <div className="hidden sm:flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <Bot size={13} />
            <span>{t('topbar.workers')}: {workerCount}</span>
          </div>
        </div>

        {/* Right: Search + Language */}
        <div className="flex items-center gap-3">
          {/* Search button */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors bg-white/50 dark:bg-gray-900/50"
          >
            <Search size={12} />
            <span className="hidden sm:inline">{t('topbar.search')}</span>
            <kbd className="hidden sm:inline ml-1 px-1 rounded text-[10px] font-mono bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              Ctrl+K
            </kbd>
          </button>

          {/* Language switch */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Globe size={13} />
              <span className="hidden sm:inline">{LANGUAGES.find((l) => l.code === i18n.language)?.label ?? i18n.language}</span>
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full mt-1 rounded-xl shadow-xl z-50 min-w-[80px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => handleLanguage(l.code)}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
                      i18n.language === l.code 
                        ? 'font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' 
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search overlay */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/20 dark:bg-black/40 backdrop-blur-sm"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="rounded-2xl shadow-2xl w-[min(92vw,520px)] max-h-[60vh] flex flex-col overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <Search size={16} className="text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('topbar.search')}
                className="flex-1 bg-transparent text-sm outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
              />
              <button type="button" onClick={() => setSearchOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto p-1">
              {filteredRoutes.map((r) => (
                <button
                  key={r.path}
                  type="button"
                  onClick={() => handleSelect(r.path)}
                  className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{r.path}</span>
                  <span className="ml-auto">{r.label}</span>
                </button>
              ))}
              {filteredRoutes.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-gray-500">{t('common.noData')}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
