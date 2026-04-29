import React from 'react';
import type { ParsedDiagnosticsView } from '../types/diagnostics-view.js';
import { VersionWidget } from './widgets/VersionWidget.js';
import { DashboardWidget } from './widgets/DashboardWidget.js';
import { ThreadWidget } from './widgets/ThreadWidget.js';
import { JvmWidget } from './widgets/JvmWidget.js';
import { ScWidget } from './widgets/ScWidget.js';
import { SmWidget } from './widgets/SmWidget.js';
import { JadWidget } from './widgets/JadWidget.js';
import { WatchWidget } from './widgets/WatchWidget.js';
import { TraceWidget } from './widgets/TraceWidget.js';
import { StackWidget } from './widgets/StackWidget.js';
import { TtWidget } from './widgets/TtWidget.js';
import { MonitorWidget } from './widgets/MonitorWidget.js';
import { ProfilerWidget } from './widgets/ProfilerWidget.js';
import { HeapdumpWidget } from './widgets/HeapdumpWidget.js';
import { MemoryWidget } from './widgets/MemoryWidget.js';
import { SyspropWidget } from './widgets/SyspropWidget.js';
import { SysenvWidget } from './widgets/SysenvWidget.js';
import { VmoptionWidget } from './widgets/VmoptionWidget.js';
import { LoggerWidget } from './widgets/LoggerWidget.js';
import { VisualEmptyState } from './VisualEmptyState.js';

interface DiagnosticsVisualPanelProps {
  readonly view: ParsedDiagnosticsView | null;
}

export function DiagnosticsVisualPanel({ view }: DiagnosticsVisualPanelProps) {
  if (!view) {
    return <VisualEmptyState message="请先执行命令。" />;
  }

  switch (view.type) {
    case 'version':
      return <VersionWidget data={(view.data as { version?: string } | undefined) ?? {}} />;
    case 'dashboard':
      return <DashboardWidget data={view.data} />;
    case 'thread':
      return <ThreadWidget data={view.data} />;
    case 'jvm':
      return <JvmWidget data={view.data} />;
    case 'sc':
      return <ScWidget data={view.data} />;
    case 'sm':
      return <SmWidget data={view.data} />;
    case 'jad':
      return <JadWidget data={view.data} />;
    case 'watch':
      return <WatchWidget data={view.data} />;
    case 'trace':
      return <TraceWidget data={view.data} />;
    case 'stack':
      return <StackWidget data={view.data} />;
    case 'tt':
      return <TtWidget data={view.data} />;
    case 'monitor':
      return <MonitorWidget data={view.data} />;
    case 'profiler':
      return <ProfilerWidget data={view.data} />;
    case 'heapdump':
      return <HeapdumpWidget data={view.data} />;
    case 'memory':
      return <MemoryWidget data={view.data} />;
    case 'sysprop':
      return <SyspropWidget data={view.data} />;
    case 'sysenv':
      return <SysenvWidget data={view.data} />;
    case 'vmoption':
      return <VmoptionWidget data={view.data} />;
    case 'logger':
      return <LoggerWidget data={view.data} />;
    default:
      return (
        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
          <div className="text-xs text-gray-400">原始输出</div>
          <pre className="mt-2 text-xs text-gray-200 whitespace-pre-wrap break-words">{view.raw}</pre>
        </div>
      );
  }
}
