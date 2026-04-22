import { ResourceDetailPage } from '../../features/resource-detail/ResourceDetailPage.js';

/**
 * Remote host detail page — delegates to the shared ResourceDetailPage
 * with remote-host-specific back navigation.
 */
export function RemoteHostDetailPage() {
  return (
    <ResourceDetailPage
      backTo="/resources?kind=REMOTE_HOST"
      backLabel="返回资源工作台"
    />
  );
}
