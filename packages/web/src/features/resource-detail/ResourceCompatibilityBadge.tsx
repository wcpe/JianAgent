import { COMPATIBILITY_MATRIX, ResourceCompatibilityTag } from '@jian-agent/shared-domain';

export interface ResourceCompatibilityBadgeProps {
  platformType?: string;
  capabilities?: any;
}

const TAG_LABELS: Record<ResourceCompatibilityTag, string> = {
  [ResourceCompatibilityTag.TERMINAL]: '终端',
  [ResourceCompatibilityTag.FILES]: '文件',
  [ResourceCompatibilityTag.PLUGINS]: '插件',
  [ResourceCompatibilityTag.LOGS]: '日志',
  [ResourceCompatibilityTag.AUDIT]: '审计',
  [ResourceCompatibilityTag.JVM]: 'JVM',
  [ResourceCompatibilityTag.MONITORING]: '监控',
  [ResourceCompatibilityTag.PLAYER_MANAGEMENT]: '玩家管理',
  [ResourceCompatibilityTag.MOTD]: 'MOTD',
  [ResourceCompatibilityTag.WHITELIST]: '白名单',
  [ResourceCompatibilityTag.OPERATORS]: '管理员',
  [ResourceCompatibilityTag.PAUSE_PLAYERS]: '暂停玩家',
};

const TAG_COLORS: Record<ResourceCompatibilityTag, string> = {
  [ResourceCompatibilityTag.TERMINAL]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  [ResourceCompatibilityTag.FILES]: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  [ResourceCompatibilityTag.PLUGINS]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  [ResourceCompatibilityTag.LOGS]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  [ResourceCompatibilityTag.AUDIT]: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  [ResourceCompatibilityTag.JVM]: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  [ResourceCompatibilityTag.MONITORING]: 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300',
  [ResourceCompatibilityTag.PLAYER_MANAGEMENT]: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
  [ResourceCompatibilityTag.MOTD]: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  [ResourceCompatibilityTag.WHITELIST]: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  [ResourceCompatibilityTag.OPERATORS]: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  [ResourceCompatibilityTag.PAUSE_PLAYERS]: 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300',
};

/**
 * Determine which tags to show based on platform type and optional capabilities.
 * If capabilities are provided, filter tags by enabled capabilities.
 * Otherwise, use the static compatibility matrix.
 */
function resolveTags(platformType: string, capabilities?: Record<string, { enabled: boolean }>): ResourceCompatibilityTag[] {
  const matrixTags = COMPATIBILITY_MATRIX[platformType] ?? [];
  
  if (!capabilities) {
    return matrixTags;
  }
  
  // Filter matrix tags by actual capabilities
  return matrixTags.filter(tag => {
    const capKey = tag.replace('-', '') as keyof typeof capabilities;
    // Map tag names to capability keys
    const capabilityMap: Record<string, string> = {
      'terminal': 'terminal',
      'files': 'files',
      'plugins': 'plugins',
      'logs': 'logs',
      'audit': 'audit',
      'jvm': 'jvm',
      'monitoring': 'monitoring',
    };
    
    const key = capabilityMap[tag];
    if (key && capabilities[key]) {
      return capabilities[key].enabled;
    }
    
    // Tags without capability mapping (player-management, motd, etc.) are shown if in matrix
    return true;
  });
}

export function ResourceCompatibilityBadge({ platformType, capabilities }: ResourceCompatibilityBadgeProps) {
  const tags = resolveTags(platformType || '', capabilities);
  
  if (tags.length === 0) {
    return null;
  }
  
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map(tag => (
        <span
          key={tag}
          className={`px-1.5 py-0.5 rounded text-xs font-medium ${TAG_COLORS[tag]}`}
          title={TAG_LABELS[tag]}
        >
          {TAG_LABELS[tag]}
        </span>
      ))}
    </div>
  );
}