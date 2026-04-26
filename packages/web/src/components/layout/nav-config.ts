import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Server, TerminalSquare, Bot, FlaskConical,
  Activity, FileText, GitCompare, Stethoscope, ScrollText,
  Bell, BellRing, Shield, MonitorCheck, Users, FileCode,
  Radar, Search, ShieldCheck, Gauge, ClipboardList, Blocks,
  TestTubeDiagonal, BarChart3, Settings, Network, Cpu,
} from 'lucide-react';

export interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

export interface NavGroup {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'server-ops',
    label: '服务器运维',
    icon: Server,
    items: [
      { path: '/resources', label: '资源工作台', icon: Server },
      { path: '/server-templates', label: '启动模板', icon: FileCode },
      { path: '/terminals', label: '终端', icon: TerminalSquare },
      { path: '/monitoring', label: '服务器监控', icon: MonitorCheck },
      { path: '/population', label: '在线人数', icon: Users },
      { path: '/jvm', label: 'JVM 管理', icon: Cpu },
      { path: '/ports', label: '端口监控', icon: Network },
    ],
  },
  {
    id: 'observability',
    label: '可观测与告警',
    icon: MonitorCheck,
    items: [
      { path: '/log-center', label: '日志中心', icon: Search },
      { path: '/diagnostics', label: '诊断', icon: Stethoscope },
      { path: '/jvm-observability', label: 'JVM 可观测', icon: Radar },
      { path: '/alerts', label: '告警', icon: Bell },
      { path: '/alert-rules', label: '告警规则', icon: Bell },
      { path: '/node-log', label: 'Node Log', icon: ScrollText },
    ],
  },
  {
    id: 'bots',
    label: '机器人',
    icon: Bot,
    items: [
      { path: '/bots', label: '机器人工作台', icon: Bot },
      { path: '/bot-groups', label: '机器人分组', icon: Users },
      { path: '/bots/scripts', label: '脚本编辑', icon: FileCode },
      { path: '/plugin-actions', label: '插件操作', icon: Blocks },
    ],
  },
  {
    id: 'testing',
    label: '压测',
    icon: FlaskConical,
    items: [
      { path: '/validation', label: '验证中心', icon: FlaskConical },
      { path: '/local-validation', label: '本地验证运行台', icon: TestTubeDiagonal },
      { path: '/quick-tests', label: '快速测试', icon: ClipboardList },
      { path: '/sessions', label: '压测会话', icon: Activity },
      { path: '/session-templates', label: '会话模板', icon: FileText },
      { path: '/sessions/compare', label: '会话对比', icon: GitCompare },
      { path: '/reports', label: '报告', icon: BarChart3 },
    ],
  },
  {
    id: 'platform',
    label: '平台管理',
    icon: Shield,
    items: [
      { path: '/settings', label: '设置', icon: Settings },
      { path: '/notifications', label: '通知渠道', icon: BellRing },
      { path: '/audit', label: '审计', icon: Shield },
      { path: '/governance', label: '治理中心', icon: ShieldCheck },
      { path: '/workers', label: 'Worker 管理', icon: Gauge },
    ],
  },
];

export function getAllNavItems(): readonly NavItem[] {
  return NAV_GROUPS.flatMap((g) => g.items);
}

export const SEARCH_ROUTES: readonly { path: string; label: string }[] =
  getAllNavItems().map((item) => ({ path: item.path, label: item.label }));

export const DEFAULT_NAV_ORDER: readonly string[] = NAV_GROUPS.map((g) => g.id);

const NAV_GROUP_MAP = new Map(NAV_GROUPS.map((g) => [g.id, g]));

export function getOrderedNavGroups(order: readonly string[]): readonly NavGroup[] {
  const result: NavGroup[] = [];
  for (const id of order) {
    const group = NAV_GROUP_MAP.get(id);
    if (group) result.push(group);
  }
  for (const group of NAV_GROUPS) {
    if (!result.includes(group)) result.push(group);
  }
  return result;
}

export function getOrderedItems(
  group: NavGroup,
  itemOrder: Readonly<Record<string, readonly string[]>>,
): readonly NavItem[] {
  const order = itemOrder[group.id];
  if (!order || order.length === 0) return group.items;
  const itemMap = new Map(group.items.map((item) => [item.path, item]));
  const result: NavItem[] = [];
  for (const path of order) {
    const item = itemMap.get(path);
    if (item) result.push(item);
  }
  for (const item of group.items) {
    if (!result.includes(item)) result.push(item);
  }
  return result;
}
