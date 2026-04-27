import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/login/LoginPage.js';
import { AuthGuard } from './components/auth/AuthGuard.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';

// ---------------------------------------------------------------------------
// Lazy-loaded page components (code-split per route)
// ---------------------------------------------------------------------------

const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage.js').then(m => ({ default: m.DashboardPage })));
const ServerConfigPage = lazy(() => import('./pages/server-config/ServerConfigPage.js').then(m => ({ default: m.ServerConfigPage })));
const TerminalPage = lazy(() => import('./pages/terminals/TerminalPage.js').then(m => ({ default: m.TerminalPage })));
const NodeLogPage = lazy(() => import('./pages/terminals/NodeLogPage.js').then(m => ({ default: m.NodeLogPage })));
const BotWorkspacePage = lazy(() => import('./pages/bots/BotWorkspacePage.js').then(m => ({ default: m.BotWorkspacePage })));
const BotScriptEditorPage = lazy(() => import('./pages/bots/BotScriptEditorPage.js').then(m => ({ default: m.BotScriptEditorPage })));
const BotConsolePage = lazy(() => import('./pages/bots/BotConsolePage.js').then(m => ({ default: m.BotConsolePage })));
const SessionListPage = lazy(() => import('./pages/SessionListPage.js').then(m => ({ default: m.SessionListPage })));
const SessionCreatePage = lazy(() => import('./pages/SessionCreatePage.js').then(m => ({ default: m.SessionCreatePage })));
const SessionDetailPage = lazy(() => import('./pages/SessionDetailPage.js').then(m => ({ default: m.SessionDetailPage })));
const DiagnosticsPage = lazy(() => import('./pages/DiagnosticsPage.js').then(m => ({ default: m.DiagnosticsPage })));
const AlertListPage = lazy(() => import('./features/alerts/AlertListPage.js'));
const AlertRulePage = lazy(() => import('./features/alerts/AlertRulePage.js'));
const AuditPage = lazy(() => import('./pages/audit/AuditPage.js').then(m => ({ default: m.AuditPage })));
const SessionTemplatePage = lazy(() => import('./pages/session-template/SessionTemplatePage.js').then(m => ({ default: m.SessionTemplatePage })));
const SessionComparePage = lazy(() => import('./pages/session-compare/SessionComparePage.js').then(m => ({ default: m.SessionComparePage })));
const StartTemplatePage = lazy(() => import('./pages/session-template/StartTemplatePage.js').then(m => ({ default: m.StartTemplatePage })));
const ServerStartTemplatePage = lazy(() => import('./pages/servers/ServerStartTemplatePage.js').then(m => ({ default: m.ServerStartTemplatePage })));
const WhitelistActionPanel = lazy(() => import('./pages/plugin/WhitelistActionPanel.js'));
const BotGroupPanel = lazy(() => import('./pages/bot/BotGroupPanel.js'));
const ReportPage = lazy(() => import('./pages/reports/ReportPage.js'));
const PhaseReportPage = lazy(() => import('./pages/reports/PhaseReportPage.js'));
const DataManagePage = lazy(() => import('./pages/reports/DataManagePage.js'));
const WorkerDashboard = lazy(() => import('./pages/workers/WorkerDashboard.js'));
const MonitoringPage = lazy(() => import('./pages/monitoring/MonitoringPage.js').then(m => ({ default: m.MonitoringPage })));
const QuickTestPage = lazy(() => import('./pages/quick-tests/QuickTestPage.js').then(m => ({ default: m.QuickTestPage })));
const ValidationCenterPage = lazy(() => import('./features/validation/ValidationCenterPage.js').then(m => ({ default: m.ValidationCenterPage })));
const PopulationPage = lazy(() => import('./pages/population/PopulationPage.js').then(m => ({ default: m.PopulationPage })));
const ServerTabPage = lazy(() => import('./pages/servers/ServerTabPage.js').then(m => ({ default: m.ServerTabPage })));
const NotificationSettingsPage = lazy(() => import('./pages/notifications/NotificationSettingsPage.js'));
const JvmObservabilityPage = lazy(() => import('./pages/observability/JvmObservabilityPage.js').then(m => ({ default: m.JvmObservabilityPage })));
const RemoteHostDetailPage = lazy(() => import('./pages/remote-hosts/RemoteHostDetailPage.js').then(m => ({ default: m.RemoteHostDetailPage })));
const LogCenterPage = lazy(() => import('./pages/log-center/LogCenterPage.js').then(m => ({ default: m.LogCenterPage })));
const ResourceDetailPage = lazy(() => import('./features/resource-detail/ResourceDetailPage.js').then(m => ({ default: m.ResourceDetailPage })));
const ResourceWorkspacePage = lazy(() => import('./features/resource-workspace/ResourceWorkspacePage.js').then(m => ({ default: m.ResourceWorkspacePage })));
const JvmDiagnosticsPage = lazy(() => import('./pages/jvm-diagnostics/JvmDiagnosticsPage.js').then(m => ({ default: m.JvmDiagnosticsPage })));
const MinecraftDrillDownPage = lazy(() => import('./pages/minecraft/MinecraftDrillDownPage.js').then(m => ({ default: m.MinecraftDrillDownPage })));
const GovernanceJobPage = lazy(() => import('./features/governance/GovernanceJobPage.js').then(m => ({ default: m.GovernanceJobPage })));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage.js').then(m => ({ default: m.SettingsPage })));
const LocalValidationPage = lazy(() => import('./features/local-validation/LocalValidationPage.js').then(m => ({ default: m.LocalValidationPage })));
const PortListPage = lazy(() => import('./pages/port/PortListPage.js'));
const JvmListPage = lazy(() => import('./pages/jvm/JvmListPage.js'));
const JvmMonitoringPage = lazy(() => import('./pages/jvm/JvmMonitoringPage.js').then(m => ({ default: m.JvmMonitoringPage })));
const FileCenterPage = lazy(() => import('./pages/files/FileCenterPage.js').then(m => ({ default: m.FileCenterPage })));

// ---------------------------------------------------------------------------
// Suspense helpers
// ---------------------------------------------------------------------------

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        <span className="text-sm text-gray-500 dark:text-gray-400">加载中...</span>
      </div>
    </div>
  );
}

function Lazy({ Component, ...props }: { Component: React.LazyExoticComponent<React.ComponentType<any>>; [key: string]: any }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <Component {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Lazy Component={DashboardPage} />} />
          <Route
            path="/resources"
            element={<Lazy Component={ResourceWorkspacePage} />}
          />
          <Route
            path="/servers"
            element={<Lazy Component={ResourceWorkspacePage} initialFilters={{ kind: 'SERVER' }} title="服务器工作台" subtitle="兼容旧入口，内部已复用统一资源工作台。" />}
          />
          <Route path="/servers/:id/:tab" element={<Lazy Component={ServerTabPage} />} />
          <Route path="/server-config" element={<Navigate to="/servers" replace />} />
          <Route path="/terminals" element={<Lazy Component={TerminalPage} />} />
          <Route path="/node-log" element={<Lazy Component={NodeLogPage} />} />
          <Route path="/bots" element={<Lazy Component={BotWorkspacePage} />} />
          <Route path="/bots/scripts" element={<Lazy Component={BotScriptEditorPage} />} />
          <Route path="/bots/:botName/console" element={<Lazy Component={BotConsolePage} />} />
          <Route path="/bot-groups" element={<Lazy Component={BotGroupPanel} />} />
          <Route path="/sessions" element={<Lazy Component={SessionListPage} />} />
          <Route path="/sessions/new" element={<Lazy Component={SessionCreatePage} />} />
          <Route path="/sessions/compare" element={<Lazy Component={SessionComparePage} />} />
          <Route path="/sessions/:id" element={<Lazy Component={SessionDetailPage} />} />
          <Route path="/session-templates" element={<Lazy Component={SessionTemplatePage} />} />
          <Route path="/start-templates" element={<Lazy Component={StartTemplatePage} />} />
          <Route path="/server-templates" element={<Lazy Component={ServerStartTemplatePage} />} />
          <Route path="/monitoring" element={<Lazy Component={MonitoringPage} />} />
          <Route path="/population" element={<Lazy Component={PopulationPage} />} />
          <Route path="/diagnostics" element={<Lazy Component={DiagnosticsPage} />} />
          <Route path="/logs" element={<Navigate to="/log-center" replace />} />
          <Route path="/log-center" element={<Lazy Component={LogCenterPage} />} />
          <Route path="/files" element={<Lazy Component={FileCenterPage} />} />
          <Route path="/alerts" element={<Lazy Component={AlertListPage} />} />
          <Route path="/alert-rules" element={<Lazy Component={AlertRulePage} />} />
          <Route path="/notifications" element={<Lazy Component={NotificationSettingsPage} />} />
          <Route path="/audit" element={<Lazy Component={AuditPage} />} />
          <Route path="/plugin-actions" element={<Lazy Component={WhitelistActionPanel} />} />
          <Route path="/reports" element={<Lazy Component={ReportPage} />} />
          <Route path="/reports/phase/:sessionId" element={<Lazy Component={PhaseReportPage} />} />
          <Route path="/reports/data" element={<Lazy Component={DataManagePage} />} />
          <Route path="/workers" element={<Lazy Component={WorkerDashboard} />} />
          <Route path="/quick-tests" element={<Lazy Component={QuickTestPage} />} />
          <Route path="/validation" element={<Lazy Component={ValidationCenterPage} />} />
          <Route path="/local-validation" element={<Lazy Component={LocalValidationPage} />} />
          <Route path="/jvm-observability" element={<Lazy Component={JvmObservabilityPage} />} />
          <Route
            path="/remote-hosts"
            element={<Lazy Component={ResourceWorkspacePage} initialFilters={{ kind: 'REMOTE_HOST' }} title="远程主机" subtitle="兼容旧入口，内部已复用统一资源工作台。" />}
          />
          <Route path="/remote-hosts/:id" element={<Lazy Component={RemoteHostDetailPage} />} />
          <Route path="/remote-hosts/:id/:tab" element={<Lazy Component={RemoteHostDetailPage} />} />
          <Route path="/resources/:id" element={<Lazy Component={ResourceDetailPage} />} />
          <Route path="/resources/:id/:tab" element={<Lazy Component={ResourceDetailPage} />} />
          <Route path="/servers/:id/jvm" element={<Lazy Component={JvmDiagnosticsPage} />} />
          <Route path="/servers/:id/minecraft" element={<Lazy Component={MinecraftDrillDownPage} />} />
          <Route path="/servers/:id/jvm-drilldown" element={<Lazy Component={JvmDiagnosticsPage} />} />
          <Route path="/servers/:id/minecraft-drilldown" element={<Lazy Component={MinecraftDrillDownPage} />} />
          <Route path="/governance" element={<Lazy Component={GovernanceJobPage} />} />
          <Route path="/settings" element={<Lazy Component={SettingsPage} />} />
          <Route path="/ports" element={<Lazy Component={PortListPage} />} />
          <Route path="/jvm" element={<Lazy Component={JvmListPage} />} />
          <Route path="/jvm/:pid/monitoring" element={<Lazy Component={JvmMonitoringPage} />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
