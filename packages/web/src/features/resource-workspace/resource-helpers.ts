import type {
  ResourceActionDto,
  ResourceValidationSummaryDto,
  ResourceWorkspaceItemDto,
} from '@jian-agent/shared-domain';

export type LauncherMode =
  | null
  | 'launcher'
  | 'managed-existing'
  | 'managed-paper'
  | 'external-server'
  | 'remote-host';

export function formatKind(item: ResourceWorkspaceItemDto): string {
  if (item.summary.kind === 'REMOTE_HOST') {
    return '远程主机';
  }
  if (item.serverType === 'external') {
    return '外置服务器';
  }
  return '托管服务器';
}

export function formatState(item: ResourceWorkspaceItemDto): string {
  const labels: Record<string, string> = {
    running: '运行中',
    stopped: '已停止',
    starting: '启动中',
    stopping: '停止中',
    error: '异常',
    unknown: '未知',
    online: '在线',
  };
  return labels[item.summary.status] ?? item.summary.status;
}

export function validationBadge(
  summary: ResourceValidationSummaryDto | null,
): { label: string; className: string } | null {
  if (!summary) {
    return null;
  }

  switch (summary.verdict) {
    case 'passed':
      return {
        label: '最近验证通过',
        className:
          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      };
    case 'failed':
      return {
        label: '最近验证失败',
        className:
          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      };
    case 'running':
      return {
        label: '验证进行中',
        className:
          'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      };
    case 'cancelled':
      return {
        label: '验证已取消',
        className:
          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      };
    default:
      return {
        label: '验证状态未知',
        className:
          'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      };
  }
}

export function actionLabel(action: ResourceActionDto): string {
  if (action.key === 'validation') {
    return '验证';
  }
  return action.label;
}
