import { ResourceDetailPage } from '../../features/resource-detail/ResourceDetailPage.js';

/**
 * Server detail page — delegates to the shared ResourceDetailPage
 * with server-specific back navigation.
 */
export function ServerTabPage() {
  return (
    <ResourceDetailPage
      backTo="/resources?kind=SERVER"
      backLabel="返回资源工作台"
    />
  );
}
