import type { ReactNode } from 'react';
import type { ResourceDetailDto } from '@jian-agent/shared-domain';
import {
  LayoutDashboard,
  Terminal as TerminalIcon,
  FolderOpen,
  Blocks,
  ScrollText,
  ShieldAlert,
  Coffee,
  Box,
  Activity,
  ShieldCheck,
  History,
  type LucideIcon,
} from 'lucide-react';

import { JvmDiagnosticsTab } from './JvmDiagnosticsTab.js';
import { MinecraftOpsTab } from './MinecraftOpsTab.js';
import { ValidationOpsTab } from './ValidationOpsTab.js';
import { MonitoringStatusTab } from './MonitoringStatusTab.js';
import { FileManagerTab } from '../../pages/servers/FileManagerTab.js';
import { PluginManagerTab } from '../../pages/servers/PluginManagerTab.js';
import { LogReplayTab } from '../../pages/servers/LogReplayTab.js';
import { AuditTab } from '../../pages/servers/AuditTab.js';

import { TerminalTab } from '../../pages/servers/TerminalTab.js';
import { SshTerminalTab } from '../../pages/servers/SshTerminalTab.js';
import { ProcessMetricsPanel } from '../server-lifecycle/ProcessMetricsPanel.js';
import { ConfigSnapshotPanel } from '../server-lifecycle/ConfigSnapshotPanel.js';

/**
 * A tab in the resource detail page.
 * `visible` receives the resource's capabilities and returns
 * whether this tab should be shown.
 */
export interface ResourceTab {
  /** Stable identifier used in the URL slug. */
  id: string;
  /** Display label shown in the tab bar. */
  label: string;
  /** Icon component for the tab. */
  icon: LucideIcon;
  /** URL slug for routing (defaults to id). */
  slug: string;
  /** Decide visibility from the resource's capability flags. */
  visible: (detail: ResourceDetailDto) => boolean;
  /** Lazy content renderer — receives the resource id. */
  render: (resourceId: string, detail: ResourceDetailDto) => ReactNode;
}

/**
 * Built-in tab registry.
 * Feature modules can push additional entries at runtime via `registerResourceTab`.
 */
const registry: ResourceTab[] = [
  {
    id: 'overview',
    label: '概览',
    icon: LayoutDashboard,
    slug: 'overview',
    visible: () => true,
    render: () => null, // placeholder — will be provided by the page itself
  },
  {
    id: 'terminal',
    label: '终端',
    icon: TerminalIcon,
    slug: 'terminal',
    visible: (detail) => detail.capabilities.terminal.enabled,
    render: (resourceId, detail) =>
      detail.kind === 'REMOTE_HOST' ? (
        <SshTerminalTab serverId={resourceId} />
      ) : (
        <TerminalTab serverId={resourceId} />
      ),
  },
  {
    id: 'files',
    label: '文件',
    icon: FolderOpen,
    slug: 'files',
    visible: (detail) => detail.capabilities.files.enabled,
    render: (resourceId) => <FileManagerTab serverId={resourceId} />,
  },
  {
    id: 'plugins',
    label: '插件',
    icon: Blocks,
    slug: 'plugins',
    visible: (detail) => detail.capabilities.plugins.enabled,
    render: (resourceId) => <PluginManagerTab serverId={resourceId} />,
  },
  {
    id: 'logs',
    label: '日志',
    icon: ScrollText,
    slug: 'logs',
    visible: (detail) => detail.capabilities.logs.enabled,
    render: (resourceId) => <LogReplayTab serverId={resourceId} />,
  },
  {
    id: 'audit',
    label: '审计',
    icon: ShieldAlert,
    slug: 'audit',
    visible: (detail) => detail.kind === 'SERVER' && detail.capabilities.audit.enabled,
    render: (resourceId) => <AuditTab serverId={resourceId} />,
  },
  {
    id: 'jvm',
    label: 'JVM',
    icon: Coffee,
    slug: 'jvm',
    visible: (detail) => detail.capabilities.jvm.enabled,
    render: (resourceId) => <JvmDiagnosticsTab resourceId={resourceId} />,
  },
  {
    id: 'minecraft',
    label: 'Minecraft',
    icon: Box,
    slug: 'minecraft',
    visible: (detail) => detail.capabilities.minecraft.enabled,
    render: (resourceId) => <MinecraftOpsTab resourceId={resourceId} />,
  },
  {
    id: 'monitoring',
    label: '监控',
    icon: Activity,
    slug: 'monitoring',
    visible: (detail) => detail.capabilities.monitoring.enabled,
    render: (_resourceId, detail) => <MonitoringStatusTab detail={detail} />,
  },
  {
    id: 'metrics',
    label: '进程指标',
    icon: Activity,
    slug: 'metrics',
    visible: (detail) => detail.kind === 'SERVER' && detail.capabilities.monitoring.enabled,
    render: (resourceId) => <ProcessMetricsPanel serverId={resourceId} />,
  },
  {
    id: 'validation',
    label: '验证与治理',
    icon: ShieldCheck,
    slug: 'validation',
    visible: (detail) => detail.capabilities.validation.enabled,
    render: (_resourceId, detail) => <ValidationOpsTab detail={detail} />,
  },
  {
    id: 'snapshots',
    label: '配置快照',
    icon: History,
    slug: 'snapshots',
    visible: (detail) => detail.kind === 'SERVER' && detail.serverType === 'managed',
    render: (resourceId) => <ConfigSnapshotPanel serverId={resourceId} />,
  },
];

/**
 * Register a custom tab at runtime (e.g. from a plugin module).
 */
export function registerResourceTab(tab: ResourceTab): void {
  const idx = registry.findIndex((t) => t.id === tab.id);
  if (idx >= 0) {
    registry[idx] = tab;
  } else {
    registry.push(tab);
  }
}

/**
 * Return the visible tabs for a given capability set.
 */
export function getVisibleTabs(detail: ResourceDetailDto): ResourceTab[] {
  return registry.filter((t) => t.visible(detail));
}

/**
 * Build a slug-to-tab map for the given capabilities.
 */
export function buildSlugMap(detail: ResourceDetailDto): Record<string, ResourceTab> {
  return Object.fromEntries(
    getVisibleTabs(detail).map((t) => [t.slug, t]),
  );
}
