import { useEffect, useState, useCallback } from 'react';
import { resourceApi } from '../../api/resource.api.js';
import type { ResourceDetailDto } from '@jian-agent/shared-domain';

export interface UseResourceDetailResult {
  detail: ResourceDetailDto | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useResourceDetail(resourceId: string | undefined): UseResourceDetailResult {
  const [detail, setDetail] = useState<ResourceDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!resourceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await resourceApi.getDetail(resourceId);
      setDetail(data);
    } catch (err: any) {
      setError(err.message ?? '加载资源详情失败');
    } finally {
      setLoading(false);
    }
  }, [resourceId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { detail, loading, error, reload };
}
