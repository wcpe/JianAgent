import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useResourceDetail } from './use-resource-detail.js';
import { useThemeStore } from '../../stores/theme.store.js';
import { getVisibleTabs, buildSlugMap } from './resource-tab-registry.js';
import { ResourceSummaryCards } from './ResourceSummaryCards.js';

export interface ResourceDetailPageProps {
  backTo?: string;
  backLabel?: string;
}

export function ResourceDetailPage({ backTo, backLabel }: ResourceDetailPageProps) {
  const { id, tab } = useParams<{ id: string; tab?: string }>();
  const { detail, loading, error, reload } = useResourceDetail(id);

  // Switch to resource sidebar mode when detail is available
  useEffect(() => {
    if (detail && id) {
      useThemeStore.getState().setSidebarMode('resource', {
        detail,
        resourceId: id,
        backTo,
        backLabel,
      });
    }
  }, [detail, id, backTo, backLabel]);

  // Clean up sidebar mode on unmount
  useEffect(() => {
    return () => {
      useThemeStore.getState().setSidebarMode('global');
    };
  }, []);

  if (!id) {
    return <div className="p-6 text-danger-500">缺少资源 ID</div>;
  }

  if (loading) {
    return <div className="p-6 text-gray-500 dark:text-gray-400">加载中…</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-danger-500 mb-2">{error}</p>
        <button
          onClick={reload}
          className="text-sm text-blue-500 hover:underline"
        >
          重试
        </button>
      </div>
    );
  }

  if (!detail) {
    return <div className="p-6 text-gray-500">资源不存在</div>;
  }

  const visibleTabs = getVisibleTabs(detail);
  const slugMap = buildSlugMap(detail);
  const activeTab = tab ?? 'overview';
  const resolvedTab = slugMap[activeTab] ? activeTab : visibleTabs[0]?.slug ?? 'overview';

  return (
    <div className="h-[calc(100vh-3.5rem)] flex-1 flex flex-col min-w-0 relative">
      <div className="flex-1 h-full overflow-auto">
        {resolvedTab === 'overview' ? (
          <ResourceSummaryCards detail={detail} />
        ) : (
          (() => {
            const tabDef = slugMap[resolvedTab];
            const rendered = tabDef?.render(id, detail);
            if (rendered) return rendered;
            return (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                {tabDef?.label ?? resolvedTab} — 即将上线
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
