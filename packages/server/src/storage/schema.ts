import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const serverConfigs = sqliteTable('server_configs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  serverType: text('server_type').notNull().default('managed'),
  javaPath: text('java_path').notNull().default(''),
  jarPath: text('jar_path').notNull().default(''),
  workDir: text('work_dir').notNull().default(''),
  jvmArgs: text('jvm_args').notNull().default('[]'),
  serverArgs: text('server_args').notNull().default('[]'),
  envVars: text('env_vars').notNull().default('{}'),
  encoding: text('encoding').notNull().default('utf-8'),
  autoRestart: integer('auto_restart', { mode: 'boolean' }).notNull().default(false),
  maxRestarts: integer('max_restarts').notNull().default(3),
  host: text('host').notNull().default('localhost'),
  port: integer('port').notNull().default(25565),
  sshHost: text('ssh_host').notNull().default(''),
  sshPort: integer('ssh_port').notNull().default(22),
  sshUsername: text('ssh_username').notNull().default(''),
  sshAuthType: text('ssh_auth_type').notNull().default('password'),
  sshPassword: text('ssh_password').notNull().default(''),
  sshKeyPath: text('ssh_key_path').notNull().default(''),
  sshPassphrase: text('ssh_passphrase').notNull().default(''),
  serverDir: text('server_dir').notNull().default(''),
  logsPath: text('logs_path').notNull().default('logs'),
  runtimeId: text('runtime_id').notNull().default(''),
  probeVersion: text('probe_version').notNull().default(''),
  preStartCommand: text('pre_start_command').notNull().default(''),
  postStartCommand: text('post_start_command').notNull().default(''),
  preStopCommand: text('pre_stop_command').notNull().default(''),
  postStopCommand: text('post_stop_command').notNull().default(''),
  scriptTimeoutMs: integer('script_timeout_ms').notNull().default(30000),
  readyPattern: text('ready_pattern').notNull().default(''),
  readyTimeoutMs: integer('ready_timeout_ms').notNull().default(120000),
  serverGroup: text('server_group').notNull().default(''),
  tags: text('tags').notNull().default('[]'),
  description: text('description').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: integer('role').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const auditRecords = sqliteTable('audit_records', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  userId: text('user_id').notNull(),
  username: text('username').notNull(),
  operation: text('operation').notNull(),
  target: text('target').notNull().default(''),
  params: text('params').notNull().default(''),
  success: integer('success', { mode: 'boolean' }).notNull(),
  ip: text('ip').notNull().default(''),
});

// --- Metrics schemas ---

export const legacyLogEntries = sqliteTable('log_entries', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  level: text('level').notNull(),
  source: text('source').notNull(),
  module: text('module').notNull(),
  message: text('message').notNull(),
  serverId: text('server_id'),
  metadata: text('metadata'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// --- Log System (remote hosts + log collection) ---

export const remoteHosts = sqliteTable('remote_hosts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  host: text('host').notNull(),
  port: integer('port').notNull().default(22),
  username: text('username').notNull().default(''),
  authType: text('auth_type').notNull().default('password'),
  passwordEncrypted: text('password_encrypted').notNull().default(''),
  keyPath: text('key_path').notNull().default(''),
  passphraseEncrypted: text('passphrase_encrypted').notNull().default(''),
  tags: text('tags').notNull().default('[]'),
  description: text('description').notNull().default(''),
  status: text('status').notNull().default('unknown'),
  lastConnectedAt: text('last_connected_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const logEntries = sqliteTable('log_entries_new', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  hostId: text('host_id').notNull(),
  hostName: text('host_name').notNull(),
  hostType: text('host_type').notNull(),
  sourceFile: text('source_file').notNull(),
  lineNumber: integer('line_number').notNull().default(0),
  timestamp: text('timestamp').notNull(),
  level: text('level').notNull().default('INFO'),
  content: text('content').notNull(),
  rawLine: text('raw_line').notNull(),
  createdAt: text('created_at').notNull().default("datetime('now')"),
});

export const logCollectionConfigs = sqliteTable('log_collection_configs', {
  id: text('id').primaryKey(),
  hostId: text('host_id').notNull(),
  hostType: text('host_type').notNull(),
  filePath: text('file_path').notNull(),
  logFormat: text('log_format').notNull().default('mc'),
  pollIntervalSec: integer('poll_interval_sec').notNull().default(30),
  lastOffset: integer('last_offset').notNull().default(0),
  lastLineHash: text('last_line_hash').notNull().default(''),
  lastCollectedAt: text('last_collected_at'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

export const logAlertRules = sqliteTable('log_alert_rules', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  hostId: text('host_id'),
  pattern: text('pattern').notNull(),
  level: text('level').notNull().default('ERROR'),
  cooldownSec: integer('cooldown_sec').notNull().default(300),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  notificationChannelId: text('notification_channel_id'),
  lastTriggeredAt: text('last_triggered_at'),
  createdAt: text('created_at').notNull(),
});

export const alertRules = sqliteTable('alert_rules', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  metric: text('metric').notNull(),
  operator: text('operator').notNull(),
  threshold: real('threshold').notNull(),
  level: text('level').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  cooldownSeconds: integer('cooldown_seconds').notNull().default(60),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const alerts = sqliteTable('alerts', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  level: text('level').notNull(),
  ruleId: text('rule_id').notNull(),
  ruleName: text('rule_name').notNull(),
  message: text('message').notNull(),
  serverId: text('server_id'),
  value: real('value'),
  threshold: real('threshold'),
  acknowledged: integer('acknowledged', { mode: 'boolean' }).notNull().default(false),
});

export const sessionTemplates = sqliteTable('session_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  botConfig: text('bot_config').notNull(),
  phases: text('phases').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// --- SP-10: Metric Snapshots ---

export const metricSnapshots = sqliteTable('metric_snapshots', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  serverId: text('server_id').notNull(),
  tps: real('tps'),
  mspt: real('mspt'),
  onlinePlayers: integer('online_players'),
  onlineBots: integer('online_bots'),
  cpuUsage: real('cpu_usage'),
  memoryUsageMb: real('memory_usage_mb'),
  maxMemoryMb: real('max_memory_mb'),
  entityCount: integer('entity_count'),
  loadedChunks: integer('loaded_chunks'),
  worldCount: integer('world_count'),
  maxPlayers: integer('max_players'),
  pluginCount: integer('plugin_count'),
  playerDetails: text('player_details'),
  pluginDetails: text('plugin_details'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// --- World Metric Snapshots ---

export const worldMetricSnapshots = sqliteTable('world_metric_snapshots', {
  id: text('id').primaryKey(),
  metricSnapshotId: text('metric_snapshot_id').notNull(),
  serverId: text('server_id').notNull(),
  timestamp: text('timestamp').notNull(),
  worldName: text('world_name').notNull(),
  environment: text('environment').notNull(),
  entityCount: integer('entity_count'),
  loadedChunks: integer('loaded_chunks'),
  entityTypes: text('entity_types'),
});

export const jmxMetricSnapshots = sqliteTable('jmx_metric_snapshots', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  serverId: text('server_id').notNull(),
  pid: text('pid').notNull(),
  heapUsedMb: real('heap_used_mb'),
  heapCommittedMb: real('heap_committed_mb'),
  heapMaxMb: real('heap_max_mb'),
  threadCount: integer('thread_count'),
  daemonThreadCount: integer('daemon_thread_count'),
  gcYoungCount: integer('gc_young_count'),
  gcFullCount: integer('gc_full_count'),
  gcYoungTimeMs: integer('gc_young_time_ms'),
  gcFullTimeMs: integer('gc_full_time_ms'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// --- SP-11: Server Start Templates ---

export const serverStartTemplates = sqliteTable('server_start_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  javaPath: text('java_path').notNull(),
  jvmArgs: text('jvm_args').notNull().default('[]'),
  serverArgs: text('server_args').notNull().default('[]'),
  envVars: text('env_vars').notNull().default('{}'),
  encoding: text('encoding').notNull().default('utf-8'),
  runtimeId: text('runtime_id').notNull().default(''),
  templateGroup: text('template_group').notNull().default(''),
  templateDescription: text('template_description').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// --- Saved Bot Configurations (persistent bot presets) ---

export const savedBotConfigs = sqliteTable('saved_bot_configs', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull(),
  namePrefix: text('name_prefix').notNull(),
  count: integer('count').notNull().default(1),
  behavior: text('behavior').notNull().default('idle'),
  autoCreate: integer('auto_create', { mode: 'boolean' }).notNull().default(true),
  rejoinStrategy: text('rejoin_strategy').notNull().default('always'),
  maxRetries: integer('max_retries').notNull().default(5),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// --- SP-13: Phase Summaries, Bot Groups, Behavior Templates ---

export const phaseSummaries = sqliteTable('phase_summaries', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  phaseId: text('phase_id').notNull(),
  phaseName: text('phase_name').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time'),
  status: text('status').notNull().default('running'),
  botCount: integer('bot_count').notNull().default(0),
  avgTps: real('avg_tps'),
  avgMspt: real('avg_mspt'),
  failureReason: text('failure_reason'),
  baselineSnapshot: text('baseline_snapshot'),
  finalSnapshot: text('final_snapshot'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const botGroups = sqliteTable('bot_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sessionId: text('session_id'),
  behaviorTemplateId: text('behavior_template_id'),
  botCount: integer('bot_count').notNull().default(0),
  config: text('config').notNull().default('{}'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const behaviorTemplates = sqliteTable('behavior_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  steps: text('steps').notNull().default('[]'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// --- SP-15: Terminal Audit & Debug Recordings ---

export const terminalAuditRecords = sqliteTable('terminal_audit_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  username: text('username').notNull(),
  serverId: text('server_id').notNull(),
  command: text('command').notNull(),
  isDanger: integer('is_danger', { mode: 'boolean' }).notNull().default(false),
  result: text('result').notNull().default('executed'),
  reason: text('reason'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const debugRecordings = sqliteTable('debug_recordings', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  serverId: text('server_id').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  stoppedAt: integer('stopped_at', { mode: 'timestamp' }),
  sizeBytes: integer('size_bytes').notNull().default(0),
  eventCount: integer('event_count').notNull().default(0),
  status: text('status').notNull().default('recording'),
});

export const debugRecordingEvents = sqliteTable('debug_recording_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  recordingId: text('recording_id').notNull(),
  offsetMs: integer('offset_ms').notNull(),
  eventType: text('event_type').notNull(),
  data: text('data').notNull(),
});

// --- Player Population Tracking ---

export const playerPopulations = sqliteTable('player_populations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  serverId: text('server_id').notNull(),
  serverName: text('server_name').notNull(),
  timestamp: text('timestamp').notNull(),
  onlinePlayers: integer('online_players').notNull(),
  maxPlayers: integer('max_players').notNull(),
});

export const fileVersions = sqliteTable('file_versions', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull(),
  filePath: text('file_path').notNull(),
  content: text('content').notNull(),
  userId: text('user_id').notNull().default(''),
  source: text('source').notNull().default('manual'),
  createdAt: integer('created_at').notNull(),
});

export const jfrTasks = sqliteTable('jfr_tasks', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull(),
  pid: text('pid').notNull(),
  recordingName: text('recording_name').notNull(),
  status: text('status').notNull(),
  filePath: text('file_path').notNull(),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  error: text('error'),
});

export const backups = sqliteTable('backups', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull(),
  serverName: text('server_name').notNull(),
  type: text('type').notNull().default('full'),
  status: text('status').notNull().default('pending'),
  fileName: text('file_name').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  includes: text('includes').notNull().default('[]'),
  note: text('note').notNull().default(''),
  createdAt: text('created_at').notNull(),
  completedAt: text('completed_at').notNull().default(''),
});

export const backupSchedules = sqliteTable('backup_schedules', {
  serverId: text('server_id').primaryKey(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  cronExpression: text('cron_expression').notNull().default('0 3 * * *'),
  type: text('type').notNull().default('full'),
  maxKeep: integer('max_keep').notNull().default(7),
});

// --- File Tasks ---

export const fileTasks = sqliteTable('file_tasks', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull(),
  kind: text('kind').notNull(),
  state: text('state').notNull().default('PENDING'),
  attempt: integer('attempt').notNull().default(1),
  maxAttempts: integer('max_attempts').notNull().default(1),
  retryable: integer('retryable', { mode: 'boolean' }).notNull().default(false),
  resumeToken: text('resume_token'),
  failureClass: text('failure_class'),
  progress: integer('progress').notNull().default(0),
  sourcePaths: text('source_paths').notNull().default('[]'),
  resultArtifact: text('result_artifact'),
  errorDetail: text('error_detail'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// --- Java Runtime Registry ---

export const javaRuntimes = sqliteTable('java_runtime', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull().default(''),
  vendor: text('vendor').notNull().default(''),
  home: text('home').notNull(),
  bin: text('bin').notNull(),
  source: text('source').notNull().default('discovered'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  autoDiscovered: integer('auto_discovered', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const notificationChannels = sqliteTable('notification_channels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  url: text('url').notNull(),
  secret: text('secret').notNull().default(''),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// --- Validation Plan, Run, and Verdict Persistence ---

export const validationPlan = sqliteTable('validation_plan', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  phasesJson: text('phases_json').notNull().default('[]'),
  successThreshold: real('success_threshold').notNull().default(1.0),
  triggerType: text('trigger_type').notNull().default('manual'),
  createdAt: text('created_at').notNull(),
});

export const validationRun = sqliteTable('validation_run', {
  id: text('id').primaryKey(),
  planId: text('plan_id').notNull(),
  sessionId: text('session_id'),
  operationJobId: text('operation_job_id'),
  status: text('status').notNull().default('pending'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  metricsJson: text('metrics_json'),
  createdAt: text('created_at').notNull(),
});

export const validationVerdict = sqliteTable('validation_verdict', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  result: text('result').notNull(),
  summary: text('summary').notNull(),
  evidenceJson: text('evidence_json'),
  createdAt: text('created_at').notNull(),
});

export const localValidationRuns = sqliteTable('local_validation_runs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  mode: text('mode').notNull(),
  serverId: text('server_id'),
  status: text('status').notNull(),
  paperVersion: text('paper_version'),
  scenarioPackId: text('scenario_pack_id').notNull(),
  requestedBotCount: integer('requested_bot_count').notNull(),
  effectiveBotCount: integer('effective_bot_count').notNull().default(0),
  requestedBy: text('requested_by').notNull(),
  failureCode: text('failure_code'),
  failureMessage: text('failure_message'),
  keepServerRunning: integer('keep_server_running', { mode: 'boolean' }).notNull().default(false),
  keepWorkspace: integer('keep_workspace', { mode: 'boolean' }).notNull().default(false),
  workspacePath: text('workspace_path').notNull(),
  startedAt: text('started_at'),
  finishedAt: text('finished_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const localValidationStages = sqliteTable(
  'local_validation_stages',
  {
    id: text('id').primaryKey(),
    runId: text('run_id').notNull(),
    stageKey: text('stage_key').notNull(),
    title: text('title').notNull(),
    status: text('status').notNull(),
    startedAt: text('started_at'),
    finishedAt: text('finished_at'),
    timeoutMs: integer('timeout_ms').notNull(),
    botGroupSnapshotJson: text('bot_group_snapshot_json').notNull().default('[]'),
    assertionSummaryJson: text('assertion_summary_json').notNull().default('{"total":0,"passed":0,"failed":0}'),
  },
  (table) => ({
    runStageKeyIdx: uniqueIndex('idx_local_validation_stage_run_key').on(table.runId, table.stageKey),
  }),
);

export const localValidationAssertions = sqliteTable(
  'local_validation_assertions',
  {
    id: text('id').primaryKey(),
    runId: text('run_id').notNull(),
    stageId: text('stage_id').notNull(),
    assertionKey: text('assertion_key').notNull(),
    title: text('title').notNull(),
    required: integer('required', { mode: 'boolean' }).notNull().default(true),
    status: text('status').notNull(),
    threshold: real('threshold').notNull(),
    actual: real('actual').notNull(),
    message: text('message').notNull(),
    evidenceRefsJson: text('evidence_refs_json').notNull().default('[]'),
  },
  (table) => ({
    stageAssertionKeyIdx: uniqueIndex('idx_local_validation_assertion_stage_key').on(table.stageId, table.assertionKey),
  }),
);

export const localValidationEvidence = sqliteTable('local_validation_evidence', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  evidenceKind: text('evidence_kind').notNull(),
  timestamp: text('timestamp').notNull(),
  summary: text('summary').notNull(),
  payloadJson: text('payload_json').notNull().default('{}'),
});

export const systemMetrics = sqliteTable('system_metrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: text('timestamp').notNull(),
  cpuUsagePercent: real('cpu_usage_percent'),
  cpuCount: integer('cpu_count'),
  loadAvg1m: real('load_avg_1m'),
  loadAvg5m: real('load_avg_5m'),
  loadAvg15m: real('load_avg_15m'),
  totalMemoryMb: real('total_memory_mb'),
  freeMemoryMb: real('free_memory_mb'),
  usedMemoryPercent: real('used_memory_percent'),
  uptimeSeconds: integer('uptime_seconds'),
  disksJson: text('disks_json'),
  networkRxBytesPerSec: real('network_rx_bytes_per_sec'),
  networkTxBytesPerSec: real('network_tx_bytes_per_sec'),
});

export const processMetrics = sqliteTable('process_metrics', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull(),
  timestamp: text('timestamp').notNull(),
  cpuPercent: real('cpu_percent').notNull(),
  rssBytes: integer('rss_bytes').notNull(),
  heapUsed: integer('heap_used'),
  heapMax: integer('heap_max'),
  threadCount: integer('thread_count'),
  fdCount: integer('fd_count'),
});

export const configSnapshots = sqliteTable('config_snapshots', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull(),
  name: text('name').notNull(),
  configJson: text('config_json').notNull(),
  createdAt: text('created_at').notNull(),
  createdBy: text('created_by').notNull().default('system'),
});

export const restartHistory = sqliteTable('restart_history', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull(),
  timestamp: text('timestamp').notNull(),
  exitCode: integer('exit_code'),
  signal: text('signal'),
  delayMs: integer('delay_ms').notNull(),
  attempt: integer('attempt').notNull(),
  success: integer('success', { mode: 'boolean' }).notNull(),
});

export const diagnosticFiles = sqliteTable(
  'diagnostic_files',
  {
    id: text('id').primaryKey(),
    pid: integer('pid').notNull(),
    processName: text('process_name').notNull(),
    fileType: text('file_type').notNull(), // 'thread-dump' | 'heap-dump' | 'jfr' | 'cpu-sample'
    filePath: text('file_path').notNull(),
    fileSize: integer('file_size').notNull(),
    createdAt: text('created_at').notNull(),
    description: text('description').notNull().default(''),
  },
  (table) => ({
    pidIdx: index('diagnostic_files_pid_idx').on(table.pid),
    fileTypeIdx: index('diagnostic_files_file_type_idx').on(table.fileType),
    createdAtIdx: index('diagnostic_files_created_at_idx').on(table.createdAt),
  }),
);

export * from '../db/schema/control-plane.schema.js';
