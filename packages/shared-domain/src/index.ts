export { ServerState } from './enums/server-state.js';
export { ServerLifecyclePhase } from './enums/server-lifecycle-phase.js';
export { BotState } from './enums/bot-state.js';
export { SessionState } from './enums/session-state.js';
export { PhaseType } from './enums/phase-type.js';
export { ProbeStatus } from './enums/probe-status.js';
export { RoleLevel } from './enums/role-level.js';
export { AlertLevel } from './enums/alert-level.js';
export { LogLevel } from './enums/log-level.js';
export { LogSource } from './enums/log-source.js';
export { JavaHelperState } from './enums/java-helper-state.js';
export { ResourceKind } from './enums/resource-kind.js';
export { FileTaskKind } from './enums/file-task-kind.js';
export { ResourceCompatibilityTag, COMPATIBILITY_MATRIX } from './enums/compatibility-tags.js';
export { TaskState } from './enums/task-state.js';
export { TerminalSessionState } from './enums/terminal-session-state.js';

// Server Lifecycle DTOs
export type { LifecyclePhaseEvent, ServerValidationResult, HookResult, LifecycleConfig } from './dto/server-lifecycle.dto.js';
export { DEFAULT_LIFECYCLE_CONFIG } from './dto/server-lifecycle.dto.js';

export type { LoginRequest, LoginResponse, RegisterRequest, UserInfo } from './dto/auth.dto.js';
export type { ServerConfig, ServerType, SshAuthType, CreateServerConfigRequest, UpdateServerConfigRequest, ServerWithStatusDto } from './dto/server-config.dto.js';
export { serverToResourceSummary } from './dto/server-config.dto.js';
export type { AuditRecord, AuditQueryParams, PaginatedResponse } from './dto/audit.dto.js';
export type {
  BotConfig,
  CreateBotGroupRequest,
  BotSummary,
  BotDetail,
  BotInventoryItem,
  BotNearbyEntity,
  BotTerrainBlock,
} from './dto/bot.dto.js';
export type {
  PhaseConfig,
  CreateSessionRequest,
  SessionConfig,
  SessionSummary,
  SessionDetail,
  PhaseRecord,
  SessionQueryParams,
} from './dto/session.dto.js';

export type {
  WorldMetricDto,
  PlayerDetailDto,
  PluginDetailDto,
  ProbeSnapshotDto,
  ProbeEventDto,
  ProbeCommandDto,
  ProbeCommandResultDto,
  ProbeSummaryDto,
} from './dto/probe.dto.js';

export { DEFAULTS } from './constants/defaults.js';
export { LIMITS } from './constants/limits.js';
export type {
  ApiResponseEnvelope,
  ApiErrorEnvelope,
  ApiResponseMeta,
  ApiErrorDetail,
  ApiResponsePayload,
} from './dto/api-response.dto.js';

// Log DTOs
export type { LogEntryDto, LogSearchRequest, LogSearchResult, LogAnalyticsResult, LogIngestEntry, LogCollectionConfigDto, CreateLogCollectionConfigRequest, LogAlertRuleDto, CreateLogAlertRuleRequest, NodeLogEntryDto } from './dto/log.dto.js';
export type { LogAggregateSearchEntryDto, LogAggregateSearchResponseDto } from './dto/log.dto.js';

// Remote Host DTOs
export type { RemoteHostDto, CreateRemoteHostRequest, UpdateRemoteHostRequest, SshConnectConfig } from './dto/remote-host.dto.js';

// System Metrics DTOs
export type { SystemMetricsDto, DiskInfoDto, CorrelatedTimelineDto } from './dto/system-metrics.dto.js';
export { remoteHostToResourceSummary } from './dto/remote-host.dto.js';

// Alert DTOs
export type { AlertDto, AlertSummaryDto } from './dto/alert.dto.js';
export { AlertMetric, AlertOperator } from './dto/alert-rule.dto.js';
export type { AlertRuleDto, CreateAlertRuleDto, UpdateAlertRuleDto } from './dto/alert-rule.dto.js';

// Metric DTOs
export type { MetricSnapshotDto, WorldMetricSnapshotDto, JmxMetricSnapshotDto, JmxMetricBucketDto } from './dto/metric-snapshot.dto.js';
export type { MonitoringHealthState, MonitoringSignalDto, MonitoringOverviewDto } from './dto/monitoring-overview.dto.js';
export type {
  StorageDialect,
  LogBackendMode,
  ProbeRuntimeKind,
  RealtimeCapacityMode,
  PlatformRuntimeCapabilityDto,
} from './dto/platform-runtime-capability.dto.js';

export type {
  JavaHelperStatusDto,
  ThreadInfoDto,
  ThreadSampleDto,
  HeapUsageDto,
  HeapSampleDto,
  JfrTaskDto,
  JfrTaskStatus,
} from './dto/java-helper.dto.js';

// SP-11: Start Templates & Stop Strategies
export type { StartTemplateDto, CreateStartTemplateDto, UpdateStartTemplateDto } from './dto/start-template.dto.js';
export type { ScheduledStopDto, ConditionalStopDto, ConditionType } from './dto/stop-strategy.dto.js';
export type { JavaProcessInfo } from './dto/java-process-info.dto.js';

// SP-12: Whitelist Actions
export type { WhitelistActionRequest, WhitelistActionResult, WhitelistActionField, WhitelistActionDefinition, PlayerDeathEventDto, PlayerTeleportEventDto } from './dto/whitelist-action.dto.js';

// SP-13: Phase Intelligence
export type { PhaseConditionDto, PhaseExitConfigDto, Combinator, FailureAction, PhaseFailureConfigDto } from './dto/phase-condition.dto.js';
export type { PhaseSummaryDto } from './dto/phase-summary.dto.js';
export type { BotGroupDto, CreateBotGroupRequestDto, ModifyBotGroupRequestDto, ApplyBehaviorToGroupDto } from './dto/bot-group.dto.js';
export type { BehaviorTemplateDto, CreateBehaviorTemplateDto, UpdateBehaviorTemplateDto, BehaviorStepDto } from './dto/behavior-template.dto.js';

// SP-14: Java Deep Sampling
export type { MethodHotspot, ProfilingResultDto, AutoAttachConfigDto } from './dto/method-hotspot.dto.js';
export type { ExceptionEventDto } from './dto/exception-event.dto.js';

// SP-15: Terminal Enhanced
export type { TerminalAuditDto, TerminalAuditQueryDto } from './dto/terminal-audit.dto.js';
export type { DebugRecordingDto, DebugRecordingEventDto } from './dto/debug-recording.dto.js';

// SP-16: Report & Export
export type { SessionReportDto, BotStatsDto, ServerPerfDto, PhaseReportEntryDto, AlertSummaryReportDto } from './dto/session-report.dto.js';
export type { ArchiveResultDto, ArchiveStatsDto } from './dto/archive.dto.js';

// SP-17: Distributed Architecture
export type { WorkerInfoDto, RegisterWorkerDto, HeartbeatDto, WorkerStatus, DistributionPlanDto, MigrateBotRequestDto, MigrationResultDto, SchedulingStrategy } from './dto/worker.dto.js';
export type { MetricSummaryDto, WorkerEventDto, DetailEventDto } from './dto/metric-summary.dto.js';

// Java Runtime Registry
export { JavaRuntimeSource } from './enums/java-runtime-source.js';
export type { JavaRuntimeDto } from './dto/java-runtime.dto.js';
export type { JavaRuntimeSelectionDto } from './dto/java-runtime-selection.dto.js';

// JVM Diagnostics & Minecraft Ops Summary
export type {
  JvmHealthState,
  JvmRiskSignalType,
  JvmRiskSignalDto,
  JvmDiagnosticActionDto,
  JvmDiagnosticsSummaryDto,
} from './dto/jvm-diagnostics-summary.dto.js';
export type {
  MinecraftQuickActionDto,
  PlayerOnlineDto,
  PluginStatusDto,
  WorldSummaryDto,
  ProbeConnectionStatusDto,
  MinecraftOpsSummaryDto,
} from './dto/minecraft-ops-summary.dto.js';
export type {
  PlayerInspectorDto,
  ChunkInspectorDto,
  BlockEntityInspectorDto,
  EntityInspectorDto,
  PluginCommandDto,
  PluginInspectorDto,
  MinecraftWorldInspectorDto,
} from './dto/minecraft-world-inspector.dto.js';

// Backup System
export type { BackupDto, BackupType, BackupStatus, CreateBackupRequest, BackupScheduleDto, UpdateBackupScheduleRequest } from './dto/backup.dto.js';

// Notification Channels
export type { NotificationChannelDto, NotificationChannelType, CreateNotificationChannelRequest, UpdateNotificationChannelRequest } from './dto/notification.dto.js';

// JVM control-plane
export type { RuntimeType, ApplicationSummaryDto, AgentStateDto } from './dto/control-plane.dto.js';

// JVM capability & target contracts
export type {
  JvmAttachCapabilityDto,
  JvmJmxCapabilityDto,
  JvmJfrCapabilityDto,
  JvmProbeCapabilityDto,
  JvmConsoleCommandCapabilityDto,
  JvmEvalScriptCapabilityDto,
  JvmCapabilityDescriptorDto,
} from './dto/jvm-capability.dto.js';
export type {
  ManagedServerTargetDto,
  ExternalPidTargetDto,
  ProbeConnectedTargetDto,
  JvmTargetDto,
} from './dto/jvm-target.dto.js';
export type { JvmOperationType, JvmOperationResultDto } from './dto/jvm-operation-result.dto.js';

// Unified core DTOs
export type { ResourceRefDto } from './dto/resource-ref.dto.js';
export type { TaskStatusDto, TaskFailureClass } from './dto/task-status.dto.js';
export type { FileTaskDto } from './dto/file-task.dto.js';
export type {
  FileTaskRequest,
  FileUploadTaskRequest,
  FilePackDownloadTaskRequest,
  FileDirCopyTaskRequest,
  FileDirMoveTaskRequest,
  FileCompressTaskRequest,
  FileDecompressTaskRequest,
} from './dto/file-task-request.dto.js';
export type { ResourceSummaryDto, HostType } from './dto/resource-summary.dto.js';
export type { ResourceHealth, LogBackendState, ResourceStatusSummaryDto } from './dto/resource-status-summary.dto.js';
export type {
  TerminalCapabilityDto,
  FileCapabilityDto,
  PluginCapabilityDto,
  LogCapabilityDto,
  AuditCapabilityDto,
  JvmCapabilityDto,
  MonitoringCapabilityDto,
  ValidationCapabilityDto,
  ResourceCapabilityDto,
} from './dto/resource-capability.dto.js';
export type { ResourceDetailDto } from './dto/resource-detail.dto.js';
export type { ResourceActionDto, ResourceActionKind } from './dto/resource-action.dto.js';
export type {
  ResourceValidationSummaryDto,
  ResourceValidationVerdict,
} from './dto/resource-validation-summary.dto.js';
export type {
  ResourceWorkspaceItemDto,
  ResourceWorkspaceSummaryDto,
  ResourceWorkspaceListDto,
} from './dto/resource-workspace.dto.js';
export { PluginInstallState } from './enums/plugin-install-state.js';
export { PluginRuntimeState } from './enums/plugin-runtime-state.js';
export type { PluginMetadataDto, PluginConfigFileDto, VersionReplacementRisk } from './dto/plugin-metadata.dto.js';
export type { PluginOperationType, PluginOperationResultDto } from './dto/plugin-operation-result.dto.js';

// Validation & Governance (Phase 4)
export type {
  LocalValidationRunStatus,
  LocalValidationStageStatus,
  LocalValidationAssertionStatus,
  LocalValidationEvidenceKind,
  LocalValidationRunDto,
  LocalValidationStageDto,
  LocalValidationAssertionDto,
  LocalValidationEvidenceDto,
  LocalValidationScenarioPackDto,
} from './dto/local-validation.dto.js';
export type { ValidationPlanDto, ValidationPhaseDto, ValidationCriterionDto } from './dto/validation-plan.dto.js';
export type { ValidationRunDto, ValidationMetricDto } from './dto/validation-run.dto.js';
export type { ValidationVerdictDto, EvidenceItemDto } from './dto/validation-verdict.dto.js';
export type { GovernanceActionDto, GovernanceActionType, GovernanceActionResult } from './dto/governance-action.dto.js';

// Process Metrics
export type { ProcessMetrics, ProcessMetricsSummary } from './dto/process-metrics.dto.js';

// Server Provisioning
export type { ServerCoreType, ProvisionServerRequest, ProvisionPhase, ProvisionProgressEvent, ProvisionServerResponse, PaperVersionInfo } from './dto/server-provision.dto.js';
