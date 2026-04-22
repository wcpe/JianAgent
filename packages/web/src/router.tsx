import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/login/LoginPage.js';
import { AuthGuard } from './components/auth/AuthGuard.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { DashboardPage } from './pages/dashboard/DashboardPage.js';
import { ServerConfigPage } from './pages/server-config/ServerConfigPage.js';
import { TerminalPage } from './pages/terminals/TerminalPage.js';
import { NodeLogPage } from './pages/terminals/NodeLogPage.js';
import { BotWorkspacePage } from './pages/bots/BotWorkspacePage.js';
import { BotScriptEditorPage } from './pages/bots/BotScriptEditorPage.js';
import { BotConsolePage } from './pages/bots/BotConsolePage.js';
import { SessionListPage } from './pages/SessionListPage.js';
import { SessionCreatePage } from './pages/SessionCreatePage.js';
import { SessionDetailPage } from './pages/SessionDetailPage.js';
import { DiagnosticsPage } from './pages/DiagnosticsPage.js';
import { LogPage } from './pages/LogPage.js';
import AlertListPage from './features/alerts/AlertListPage.js';
import AlertRulePage from './features/alerts/AlertRulePage.js';
import { AuditPage } from './pages/audit/AuditPage.js';
import { SessionTemplatePage } from './pages/session-template/SessionTemplatePage.js';
import { SessionComparePage } from './pages/session-compare/SessionComparePage.js';
import { StartTemplatePage } from './pages/session-template/StartTemplatePage.js';
import { ServerStartTemplatePage } from './pages/servers/ServerStartTemplatePage.js';
import WhitelistActionPanel from './pages/plugin/WhitelistActionPanel.js';
import BotGroupPanel from './pages/bot/BotGroupPanel.js';
import ReportPage from './pages/reports/ReportPage.js';
import PhaseReportPage from './pages/reports/PhaseReportPage.js';
import DataManagePage from './pages/reports/DataManagePage.js';
import WorkerDashboard from './pages/workers/WorkerDashboard.js';
import { MonitoringPage } from './pages/monitoring/MonitoringPage.js';
import { QuickTestPage } from './pages/quick-tests/QuickTestPage.js';
import { ValidationCenterPage } from './features/validation/ValidationCenterPage.js';
import { PopulationPage } from './pages/population/PopulationPage.js';
import { ServerTabPage } from './pages/servers/ServerTabPage.js';
import NotificationSettingsPage from './pages/notifications/NotificationSettingsPage.js';
import { JvmObservabilityPage } from './pages/observability/JvmObservabilityPage.js';
import { RemoteHostDetailPage } from './pages/remote-hosts/RemoteHostDetailPage.js';
import { LogCenterPage } from './pages/log-center/LogCenterPage.js';
import { ResourceDetailPage } from './features/resource-detail/ResourceDetailPage.js';
import { ResourceWorkspacePage } from './features/resource-workspace/ResourceWorkspacePage.js';
import { JvmDiagnosticsPage } from './pages/jvm-diagnostics/JvmDiagnosticsPage.js';
import { MinecraftDrillDownPage } from './pages/minecraft/MinecraftDrillDownPage.js';
import { GovernanceJobPage } from './features/governance/GovernanceJobPage.js';
import { LocalValidationPage } from './features/local-validation/LocalValidationPage.js';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route
            path="/resources"
            element={<ResourceWorkspacePage />}
          />
          <Route
            path="/servers"
            element={<ResourceWorkspacePage initialFilters={{ kind: 'SERVER' }} title="服务器工作台" subtitle="兼容旧入口，内部已复用统一资源工作台。" />}
          />
          <Route path="/servers/:id/:tab" element={<ServerTabPage />} />
          <Route path="/server-config" element={<Navigate to="/servers" replace />} />
          <Route path="/terminals" element={<TerminalPage />} />
          <Route path="/node-log" element={<NodeLogPage />} />
          <Route path="/bots" element={<BotWorkspacePage />} />
          <Route path="/bots/scripts" element={<BotScriptEditorPage />} />
          <Route path="/bots/:botName/console" element={<BotConsolePage />} />
          <Route path="/bot-groups" element={<BotGroupPanel />} />
          <Route path="/sessions" element={<SessionListPage />} />
          <Route path="/sessions/new" element={<SessionCreatePage />} />
          <Route path="/sessions/compare" element={<SessionComparePage />} />
          <Route path="/sessions/:id" element={<SessionDetailPage />} />
          <Route path="/session-templates" element={<SessionTemplatePage />} />
          <Route path="/start-templates" element={<StartTemplatePage />} />
          <Route path="/server-templates" element={<ServerStartTemplatePage />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
          <Route path="/population" element={<PopulationPage />} />
          <Route path="/diagnostics" element={<DiagnosticsPage />} />
          <Route path="/logs" element={<LogPage />} />
          <Route path="/log-center" element={<LogCenterPage />} />
          <Route path="/alerts" element={<AlertListPage />} />
          <Route path="/alert-rules" element={<AlertRulePage />} />
          <Route path="/notifications" element={<NotificationSettingsPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/plugin-actions" element={<WhitelistActionPanel />} />
          <Route path="/reports" element={<ReportPage />} />
          <Route path="/reports/phase/:sessionId" element={<PhaseReportPage />} />
          <Route path="/reports/data" element={<DataManagePage />} />
          <Route path="/workers" element={<WorkerDashboard />} />
          <Route path="/quick-tests" element={<QuickTestPage />} />
          <Route path="/validation" element={<ValidationCenterPage />} />
          <Route path="/local-validation" element={<LocalValidationPage />} />
          <Route path="/jvm-observability" element={<JvmObservabilityPage />} />
          <Route
            path="/remote-hosts"
            element={<ResourceWorkspacePage initialFilters={{ kind: 'REMOTE_HOST' }} title="远程主机" subtitle="兼容旧入口，内部已复用统一资源工作台。" />}
          />
          <Route path="/remote-hosts/:id" element={<RemoteHostDetailPage />} />
          <Route path="/remote-hosts/:id/:tab" element={<RemoteHostDetailPage />} />
          <Route path="/resources/:id" element={<ResourceDetailPage />} />
          <Route path="/resources/:id/:tab" element={<ResourceDetailPage />} />
          <Route path="/servers/:id/jvm" element={<JvmDiagnosticsPage />} />
          <Route path="/servers/:id/minecraft" element={<MinecraftDrillDownPage />} />
          <Route path="/servers/:id/jvm-drilldown" element={<JvmDiagnosticsPage />} />
          <Route path="/servers/:id/minecraft-drilldown" element={<MinecraftDrillDownPage />} />
          <Route path="/governance" element={<GovernanceJobPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
