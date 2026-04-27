import type Database from 'better-sqlite3';

export function getCoreSchemaSql(): string {
  return `
      CREATE TABLE IF NOT EXISTS server_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        server_type TEXT NOT NULL DEFAULT 'managed',
        java_path TEXT NOT NULL DEFAULT '',
        jar_path TEXT NOT NULL DEFAULT '',
        work_dir TEXT NOT NULL DEFAULT '',
        jvm_args TEXT NOT NULL DEFAULT '[]',
        server_args TEXT NOT NULL DEFAULT '[]',
        env_vars TEXT NOT NULL DEFAULT '{}',
        encoding TEXT NOT NULL DEFAULT 'utf-8',
        auto_restart INTEGER NOT NULL DEFAULT 0,
        max_restarts INTEGER NOT NULL DEFAULT 3,
        is_active INTEGER NOT NULL DEFAULT 0,
        host TEXT NOT NULL DEFAULT 'localhost',
        port INTEGER NOT NULL DEFAULT 25565,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_records (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        operation TEXT NOT NULL,
        target TEXT NOT NULL DEFAULT '',
        params TEXT NOT NULL DEFAULT '',
        success INTEGER NOT NULL,
        ip TEXT NOT NULL DEFAULT ''
      );

      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_records(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_records(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_operation ON audit_records(operation);

      CREATE TABLE IF NOT EXISTS log_entries (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL,
        source TEXT NOT NULL,
        module TEXT NOT NULL,
        message TEXT NOT NULL,
        server_id TEXT,
        metadata TEXT,
        created_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_log_timestamp ON log_entries(timestamp);
      CREATE INDEX IF NOT EXISTS idx_log_level ON log_entries(level);
      CREATE INDEX IF NOT EXISTS idx_log_source ON log_entries(source);
      CREATE INDEX IF NOT EXISTS idx_log_server_id ON log_entries(server_id);
      CREATE INDEX IF NOT EXISTS idx_log_server_timestamp ON log_entries(server_id, timestamp);

      -- New log system tables (remote hosts + collection + FTS5) --
      CREATE TABLE IF NOT EXISTS remote_hosts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL DEFAULT 22,
        username TEXT NOT NULL DEFAULT '',
        auth_type TEXT NOT NULL DEFAULT 'password',
        password_encrypted TEXT NOT NULL DEFAULT '',
        key_path TEXT NOT NULL DEFAULT '',
        passphrase_encrypted TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '[]',
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'unknown',
        last_connected_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS log_entries_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        host_id TEXT NOT NULL,
        host_name TEXT NOT NULL,
        host_type TEXT NOT NULL,
        source_file TEXT NOT NULL,
        line_number INTEGER NOT NULL DEFAULT 0,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'INFO',
        content TEXT NOT NULL,
        raw_line TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_log_entries_new_host ON log_entries_new(host_id);
      CREATE INDEX IF NOT EXISTS idx_log_entries_new_time ON log_entries_new(timestamp);
      CREATE INDEX IF NOT EXISTS idx_log_entries_new_level ON log_entries_new(level);

      CREATE VIRTUAL TABLE IF NOT EXISTS log_entries_fts USING fts5(
        content, raw_line,
        content='log_entries_new',
        content_rowid='id',
        tokenize='unicode61 remove_diacritics 2'
      );

      CREATE TRIGGER IF NOT EXISTS log_entries_ai AFTER INSERT ON log_entries_new BEGIN
        INSERT INTO log_entries_fts(rowid, content, raw_line) VALUES (new.id, new.content, new.raw_line);
      END;
      CREATE TRIGGER IF NOT EXISTS log_entries_ad AFTER DELETE ON log_entries_new BEGIN
        INSERT INTO log_entries_fts(log_entries_fts, rowid, content, raw_line) VALUES ('delete', old.id, old.content, old.raw_line);
      END;

      CREATE TABLE IF NOT EXISTS log_collection_configs (
        id TEXT PRIMARY KEY,
        host_id TEXT NOT NULL,
        host_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        log_format TEXT NOT NULL DEFAULT 'mc',
        poll_interval_sec INTEGER NOT NULL DEFAULT 30,
        last_offset INTEGER NOT NULL DEFAULT 0,
        last_line_hash TEXT NOT NULL DEFAULT '',
        last_collected_at TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_log_collection_configs_host_id ON log_collection_configs(host_id);

      CREATE TABLE IF NOT EXISTS log_alert_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        host_id TEXT,
        pattern TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'ERROR',
        cooldown_sec INTEGER NOT NULL DEFAULT 300,
        enabled INTEGER NOT NULL DEFAULT 1,
        notification_channel_id TEXT,
        last_triggered_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_log_alert_rules_host_id ON log_alert_rules(host_id);

      CREATE TABLE IF NOT EXISTS alert_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        metric TEXT NOT NULL,
        operator TEXT NOT NULL,
        threshold REAL NOT NULL,
        level TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        cooldown_seconds INTEGER NOT NULL DEFAULT 60,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL,
        rule_id TEXT NOT NULL,
        rule_name TEXT NOT NULL,
        message TEXT NOT NULL,
        server_id TEXT,
        value REAL,
        threshold REAL,
        acknowledged INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);
      CREATE INDEX IF NOT EXISTS idx_alerts_level ON alerts(level);
      CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);

      CREATE TABLE IF NOT EXISTS session_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        bot_config TEXT NOT NULL,
        phases TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS metric_snapshots (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        server_id TEXT NOT NULL,
        tps REAL,
        mspt REAL,
        online_players INTEGER,
        online_bots INTEGER,
        cpu_usage REAL,
        memory_usage_mb REAL,
        entity_count INTEGER,
        loaded_chunks INTEGER,
        created_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_metric_snapshots_server_timestamp ON metric_snapshots(server_id, timestamp);

      CREATE TABLE IF NOT EXISTS world_metric_snapshots (
        id TEXT PRIMARY KEY,
        metric_snapshot_id TEXT NOT NULL,
        server_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        world_name TEXT NOT NULL,
        environment TEXT NOT NULL,
        entity_count INTEGER,
        loaded_chunks INTEGER,
        entity_types TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_world_metric_snapshots_metric_snapshot_id ON world_metric_snapshots(metric_snapshot_id);

      CREATE TABLE IF NOT EXISTS jmx_metric_snapshots (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        server_id TEXT NOT NULL,
        pid TEXT NOT NULL,
        heap_used_mb REAL,
        heap_committed_mb REAL,
        heap_max_mb REAL,
        thread_count INTEGER,
        daemon_thread_count INTEGER,
        gc_young_count INTEGER,
        gc_full_count INTEGER,
        gc_young_time_ms INTEGER,
        gc_full_time_ms INTEGER,
        created_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_world_metric_server_timestamp ON world_metric_snapshots(server_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_jmx_metric_server_timestamp ON jmx_metric_snapshots(server_id, timestamp);

      CREATE TABLE IF NOT EXISTS server_start_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        java_path TEXT NOT NULL,
        jvm_args TEXT NOT NULL DEFAULT '[]',
        server_args TEXT NOT NULL DEFAULT '[]',
        env_vars TEXT NOT NULL DEFAULT '{}',
        encoding TEXT NOT NULL DEFAULT 'utf-8',
        runtime_id TEXT NOT NULL DEFAULT '',
        template_group TEXT NOT NULL DEFAULT '',
        template_description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS saved_bot_configs (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        name_prefix TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 1,
        behavior TEXT NOT NULL DEFAULT 'idle',
        auto_create INTEGER NOT NULL DEFAULT 1,
        rejoin_strategy TEXT NOT NULL DEFAULT 'always',
        max_retries INTEGER NOT NULL DEFAULT 5,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_saved_bot_configs_server_id ON saved_bot_configs(server_id);

      CREATE TABLE IF NOT EXISTS phase_summaries (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        phase_id TEXT NOT NULL,
        phase_name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        status TEXT NOT NULL DEFAULT 'running',
        bot_count INTEGER NOT NULL DEFAULT 0,
        avg_tps REAL,
        avg_mspt REAL,
        failure_reason TEXT,
        baseline_snapshot TEXT,
        final_snapshot TEXT,
        created_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_phase_summaries_session_id ON phase_summaries(session_id);

      CREATE TABLE IF NOT EXISTS bot_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        session_id TEXT,
        behavior_template_id TEXT,
        bot_count INTEGER NOT NULL DEFAULT 0,
        config TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS behavior_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        steps TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS terminal_audit_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        server_id TEXT NOT NULL,
        command TEXT NOT NULL,
        is_danger INTEGER NOT NULL DEFAULT 0,
        result TEXT NOT NULL DEFAULT 'executed',
        reason TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS debug_recordings (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        server_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        stopped_at INTEGER,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        event_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'recording'
      );

      CREATE TABLE IF NOT EXISTS debug_recording_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recording_id TEXT NOT NULL,
        offset_ms INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        server_id TEXT NOT NULL,
        bot_config_id TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'CREATED',
        current_phase TEXT,
        phases_json TEXT,
        started_at TEXT,
        finished_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS phase_record (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        phase TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        duration_ms INTEGER,
        bot_count INTEGER NOT NULL,
        behavior TEXT NOT NULL,
        avg_tps REAL,
        peak_memory_mb INTEGER,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS player_populations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id TEXT NOT NULL,
        server_name TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        online_players INTEGER NOT NULL DEFAULT 0,
        max_players INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS restart_history (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        exit_code INTEGER,
        signal TEXT,
        delay_ms INTEGER NOT NULL,
        attempt INTEGER NOT NULL,
        success INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_restart_history_server_id ON restart_history(server_id);
      CREATE INDEX IF NOT EXISTS idx_restart_history_timestamp ON restart_history(timestamp);

      CREATE TABLE IF NOT EXISTS system_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        cpu_usage_percent REAL,
        cpu_count INTEGER,
        load_avg_1m REAL,
        load_avg_5m REAL,
        load_avg_15m REAL,
        total_memory_mb REAL,
        free_memory_mb REAL,
        used_memory_percent REAL,
        uptime_seconds INTEGER,
        disks_json TEXT,
        network_rx_bytes_per_sec REAL,
        network_tx_bytes_per_sec REAL
      );
      CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp);
    `;
}

export function getControlPlaneSchemaSql(): string {
  return `
      CREATE TABLE IF NOT EXISTS cp_tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cp_environments (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cp_clusters (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        environment_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cp_hosts (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        environment_id TEXT NOT NULL,
        cluster_id TEXT NOT NULL,
        hostname TEXT NOT NULL,
        ip TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cp_applications (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        environment_id TEXT NOT NULL,
        name TEXT NOT NULL,
        runtime_type TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cp_instances (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        environment_id TEXT NOT NULL,
        application_id TEXT NOT NULL,
        host_id TEXT NOT NULL,
        runtime_type TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'stopped',
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cp_operation_jobs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        target TEXT NOT NULL,
        version TEXT NOT NULL,
        batch TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        status TEXT NOT NULL,
        danger INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cp_approval_tickets (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'pending',
        confirmation_code TEXT NOT NULL DEFAULT '',
        expires_at INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      -- Validation Plan, Run, and Verdict tables --
      CREATE TABLE IF NOT EXISTS validation_plan (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        phases_json TEXT NOT NULL DEFAULT '[]',
        success_threshold REAL NOT NULL DEFAULT 1.0,
        trigger_type TEXT NOT NULL DEFAULT 'manual',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_validation_plan_target ON validation_plan(target_type, target_id);

      CREATE TABLE IF NOT EXISTS validation_run (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        session_id TEXT,
        operation_job_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        started_at TEXT,
        completed_at TEXT,
        metrics_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_validation_run_plan ON validation_run(plan_id);
      CREATE INDEX IF NOT EXISTS idx_validation_run_status ON validation_run(status);

      CREATE TABLE IF NOT EXISTS validation_verdict (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        result TEXT NOT NULL,
        summary TEXT NOT NULL,
        evidence_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_validation_verdict_run ON validation_verdict(run_id);

      CREATE TABLE IF NOT EXISTS local_validation_runs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mode TEXT NOT NULL,
        server_id TEXT,
        status TEXT NOT NULL,
        paper_version TEXT,
        scenario_pack_id TEXT NOT NULL,
        requested_bot_count INTEGER NOT NULL,
        effective_bot_count INTEGER NOT NULL DEFAULT 0,
        requested_by TEXT NOT NULL,
        failure_code TEXT,
        failure_message TEXT,
        keep_server_running INTEGER NOT NULL DEFAULT 0,
        keep_workspace INTEGER NOT NULL DEFAULT 0,
        workspace_path TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_local_validation_runs_status ON local_validation_runs(status);
      CREATE INDEX IF NOT EXISTS idx_local_validation_runs_updated_at ON local_validation_runs(updated_at);

      CREATE TABLE IF NOT EXISTS local_validation_stages (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        stage_key TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        timeout_ms INTEGER NOT NULL,
        bot_group_snapshot_json TEXT NOT NULL DEFAULT '[]',
        assertion_summary_json TEXT NOT NULL DEFAULT '{"total":0,"passed":0,"failed":0}'
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_local_validation_stage_run_key ON local_validation_stages(run_id, stage_key);
      CREATE INDEX IF NOT EXISTS idx_local_validation_stages_run_id ON local_validation_stages(run_id);

      CREATE TABLE IF NOT EXISTS local_validation_assertions (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        stage_id TEXT NOT NULL,
        assertion_key TEXT NOT NULL,
        title TEXT NOT NULL,
        required INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL,
        threshold REAL NOT NULL,
        actual REAL NOT NULL,
        message TEXT NOT NULL,
        evidence_refs_json TEXT NOT NULL DEFAULT '[]'
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_local_validation_assertion_stage_key ON local_validation_assertions(stage_id, assertion_key);
      CREATE INDEX IF NOT EXISTS idx_local_validation_assertions_stage_id ON local_validation_assertions(stage_id);
      CREATE INDEX IF NOT EXISTS idx_local_validation_assertions_run_id ON local_validation_assertions(run_id);

      CREATE TABLE IF NOT EXISTS local_validation_evidence (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        evidence_kind TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        summary TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_local_validation_evidence_run_id ON local_validation_evidence(run_id);
    `;
}

export function getAuxiliarySchemaSql(): string {
  return `
      CREATE TABLE IF NOT EXISTS diagnostic_files (
        id TEXT PRIMARY KEY,
        pid INTEGER NOT NULL,
        process_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT ''
      );

      CREATE INDEX IF NOT EXISTS diagnostic_files_pid_idx ON diagnostic_files(pid);
      CREATE INDEX IF NOT EXISTS diagnostic_files_file_type_idx ON diagnostic_files(file_type);
      CREATE INDEX IF NOT EXISTS diagnostic_files_created_at_idx ON diagnostic_files(created_at);

      CREATE TABLE IF NOT EXISTS file_versions (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content TEXT NOT NULL,
        user_id TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'manual',
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS jfr_tasks (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        pid TEXT NOT NULL,
        recording_name TEXT NOT NULL,
        status TEXT NOT NULL,
        file_path TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        error TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_jfr_tasks_server_started ON jfr_tasks(server_id, started_at);
      CREATE INDEX IF NOT EXISTS idx_jfr_tasks_status ON jfr_tasks(status);

      CREATE TABLE IF NOT EXISTS backups (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        server_name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'full',
        status TEXT NOT NULL DEFAULT 'pending',
        file_name TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        includes TEXT NOT NULL DEFAULT '[]',
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        completed_at TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS backup_schedules (
        server_id TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 0,
        cron_expression TEXT NOT NULL DEFAULT '0 3 * * *',
        type TEXT NOT NULL DEFAULT 'full',
        max_keep INTEGER NOT NULL DEFAULT 7
      );

      CREATE TABLE IF NOT EXISTS notification_channels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT NOT NULL,
        secret TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS file_tasks (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'PENDING',
        attempt INTEGER NOT NULL DEFAULT 1,
        max_attempts INTEGER NOT NULL DEFAULT 1,
        retryable INTEGER NOT NULL DEFAULT 0,
        resume_token TEXT,
        failure_class TEXT,
        progress INTEGER NOT NULL DEFAULT 0,
        source_paths TEXT NOT NULL DEFAULT '[]',
        result_artifact TEXT,
        error_detail TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_file_tasks_server_id ON file_tasks(server_id);
      CREATE INDEX IF NOT EXISTS idx_file_tasks_state ON file_tasks(state);

      CREATE TABLE IF NOT EXISTS java_runtime (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '',
        vendor TEXT NOT NULL DEFAULT '',
        home TEXT NOT NULL,
        bin TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'discovered',
        is_default INTEGER NOT NULL DEFAULT 0,
        auto_discovered INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_java_runtime_default ON java_runtime(is_default);
      CREATE INDEX IF NOT EXISTS idx_java_runtime_source ON java_runtime(source);
    `;
}

/** Adds missing columns to existing tables (safe to re-run). */
export function runConditionalMigrations(sqlite: Database.Database): void {
  const localValidationRunColumns = sqlite
    .prepare("PRAGMA table_info('local_validation_runs')")
    .all() as Array<{ name: string }>;

  if (!localValidationRunColumns.some((c) => c.name === 'name')) {
    sqlite.exec(
      "ALTER TABLE local_validation_runs ADD COLUMN name TEXT NOT NULL DEFAULT '';",
    );
  }
  if (!localValidationRunColumns.some((c) => c.name === 'mode')) {
    sqlite.exec(
      "ALTER TABLE local_validation_runs ADD COLUMN mode TEXT NOT NULL DEFAULT 'init-paper';",
    );
  }
  if (!localValidationRunColumns.some((c) => c.name === 'server_id')) {
    sqlite.exec(
      'ALTER TABLE local_validation_runs ADD COLUMN server_id TEXT;',
    );
  }
  if (!localValidationRunColumns.some((c) => c.name === 'status')) {
    sqlite.exec(
      "ALTER TABLE local_validation_runs ADD COLUMN status TEXT NOT NULL DEFAULT 'CREATED';",
    );
  }
  if (!localValidationRunColumns.some((c) => c.name === 'paper_version')) {
    sqlite.exec(
      'ALTER TABLE local_validation_runs ADD COLUMN paper_version TEXT;',
    );
  }
  if (!localValidationRunColumns.some((c) => c.name === 'scenario_pack_id')) {
    sqlite.exec(
      "ALTER TABLE local_validation_runs ADD COLUMN scenario_pack_id TEXT NOT NULL DEFAULT 'integrated-combat';",
    );
  }
  if (!localValidationRunColumns.some((c) => c.name === 'requested_bot_count')) {
    sqlite.exec(
      'ALTER TABLE local_validation_runs ADD COLUMN requested_bot_count INTEGER NOT NULL DEFAULT 0;',
    );
  }
  if (!localValidationRunColumns.some((c) => c.name === 'effective_bot_count')) {
    sqlite.exec(
      'ALTER TABLE local_validation_runs ADD COLUMN effective_bot_count INTEGER NOT NULL DEFAULT 0;',
    );
  }
  if (!localValidationRunColumns.some((c) => c.name === 'requested_by')) {
    sqlite.exec(
      "ALTER TABLE local_validation_runs ADD COLUMN requested_by TEXT NOT NULL DEFAULT 'system';",
    );
  }
  if (!localValidationRunColumns.some((c) => c.name === 'failure_code')) {
    sqlite.exec(
      'ALTER TABLE local_validation_runs ADD COLUMN failure_code TEXT;',
    );
  }
  if (!localValidationRunColumns.some((c) => c.name === 'failure_message')) {
    sqlite.exec(
      'ALTER TABLE local_validation_runs ADD COLUMN failure_message TEXT;',
    );
  }
  if (!localValidationRunColumns.some((c) => c.name === 'keep_server_running')) {
    sqlite.exec(
      'ALTER TABLE local_validation_runs ADD COLUMN keep_server_running INTEGER NOT NULL DEFAULT 0;',
    );
  }
  if (!localValidationRunColumns.some((c) => c.name === 'keep_workspace')) {
    sqlite.exec(
      'ALTER TABLE local_validation_runs ADD COLUMN keep_workspace INTEGER NOT NULL DEFAULT 0;',
    );
  }
  if (!localValidationRunColumns.some((c) => c.name === 'workspace_path')) {
    sqlite.exec(
      "ALTER TABLE local_validation_runs ADD COLUMN workspace_path TEXT NOT NULL DEFAULT '';",
    );
  }
  if (!localValidationRunColumns.some((c) => c.name === 'started_at')) {
    sqlite.exec(
      'ALTER TABLE local_validation_runs ADD COLUMN started_at TEXT;',
    );
  }
  if (!localValidationRunColumns.some((c) => c.name === 'finished_at')) {
    sqlite.exec(
      'ALTER TABLE local_validation_runs ADD COLUMN finished_at TEXT;',
    );
  }
  if (!localValidationRunColumns.some((c) => c.name === 'created_at')) {
    sqlite.exec(
      "ALTER TABLE local_validation_runs ADD COLUMN created_at TEXT NOT NULL DEFAULT '';",
    );
  }
  if (!localValidationRunColumns.some((c) => c.name === 'updated_at')) {
    sqlite.exec(
      "ALTER TABLE local_validation_runs ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';",
    );
  }

  const cpApprovalColumns = sqlite
    .prepare("PRAGMA table_info('cp_approval_tickets')")
    .all() as Array<{ name: string }>;

  if (!cpApprovalColumns.some((c) => c.name === 'confirmation_code')) {
    sqlite.exec("ALTER TABLE cp_approval_tickets ADD COLUMN confirmation_code TEXT NOT NULL DEFAULT ''; ");
  }
  if (!cpApprovalColumns.some((c) => c.name === 'expires_at')) {
    sqlite.exec("ALTER TABLE cp_approval_tickets ADD COLUMN expires_at INTEGER NOT NULL DEFAULT 0; ");
  }

  const cpOperationJobColumns = sqlite
    .prepare("PRAGMA table_info('cp_operation_jobs')")
    .all() as Array<{ name: string }>;

  if (!cpOperationJobColumns.some((c) => c.name === 'validation_plan_id')) {
    sqlite.exec("ALTER TABLE cp_operation_jobs ADD COLUMN validation_plan_id TEXT;");
  }
  if (!cpOperationJobColumns.some((c) => c.name === 'validation_run_id')) {
    sqlite.exec("ALTER TABLE cp_operation_jobs ADD COLUMN validation_run_id TEXT;");
  }

  const serverConfigColumns = sqlite
    .prepare("PRAGMA table_info('server_configs')")
    .all() as Array<{ name: string }>;

  if (!serverConfigColumns.some((column) => column.name === 'is_active')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0;");
  }
  if (!serverConfigColumns.some((column) => column.name === 'host')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN host TEXT NOT NULL DEFAULT 'localhost';");
  }
  if (!serverConfigColumns.some((column) => column.name === 'port')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN port INTEGER NOT NULL DEFAULT 25565;");
  }
  if (!serverConfigColumns.some((column) => column.name === 'server_type')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN server_type TEXT NOT NULL DEFAULT 'managed';");
  }
  if (!serverConfigColumns.some((c) => c.name === 'ssh_host')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN ssh_host TEXT NOT NULL DEFAULT '';");
  }
  if (!serverConfigColumns.some((c) => c.name === 'ssh_port')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN ssh_port INTEGER NOT NULL DEFAULT 22;");
  }
  if (!serverConfigColumns.some((c) => c.name === 'ssh_username')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN ssh_username TEXT NOT NULL DEFAULT '';");
  }
  if (!serverConfigColumns.some((c) => c.name === 'ssh_auth_type')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN ssh_auth_type TEXT NOT NULL DEFAULT 'password';");
  }
  if (!serverConfigColumns.some((c) => c.name === 'ssh_password')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN ssh_password TEXT NOT NULL DEFAULT '';");
  }
  if (!serverConfigColumns.some((c) => c.name === 'ssh_key_path')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN ssh_key_path TEXT NOT NULL DEFAULT '';");
  }
  if (!serverConfigColumns.some((c) => c.name === 'ssh_passphrase')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN ssh_passphrase TEXT NOT NULL DEFAULT '';");
  }
  if (!serverConfigColumns.some((c) => c.name === 'server_dir')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN server_dir TEXT NOT NULL DEFAULT '';");
  }
  if (!serverConfigColumns.some((c) => c.name === 'probe_version')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN probe_version TEXT NOT NULL DEFAULT '';");
  }
  if (!serverConfigColumns.some((c) => c.name === 'logs_path')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN logs_path TEXT NOT NULL DEFAULT 'logs';");
  }
  if (!serverConfigColumns.some((c) => c.name === 'runtime_id')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN runtime_id TEXT NOT NULL DEFAULT '';");
  }
  if (!serverConfigColumns.some((c) => c.name === 'pre_start_command')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN pre_start_command TEXT NOT NULL DEFAULT '';");
  }
  if (!serverConfigColumns.some((c) => c.name === 'post_start_command')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN post_start_command TEXT NOT NULL DEFAULT '';");
  }
  if (!serverConfigColumns.some((c) => c.name === 'pre_stop_command')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN pre_stop_command TEXT NOT NULL DEFAULT '';");
  }
  if (!serverConfigColumns.some((c) => c.name === 'post_stop_command')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN post_stop_command TEXT NOT NULL DEFAULT '';");
  }
  if (!serverConfigColumns.some((c) => c.name === 'script_timeout_ms')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN script_timeout_ms INTEGER NOT NULL DEFAULT 30000;");
  }
  if (!serverConfigColumns.some((c) => c.name === 'ready_pattern')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN ready_pattern TEXT NOT NULL DEFAULT '';");
  }
  if (!serverConfigColumns.some((c) => c.name === 'ready_timeout_ms')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN ready_timeout_ms INTEGER NOT NULL DEFAULT 120000;");
  }
  if (!serverConfigColumns.some((c) => c.name === 'server_group')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN server_group TEXT NOT NULL DEFAULT '';");
  }
  if (!serverConfigColumns.some((c) => c.name === 'tags')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';");
  }
  if (!serverConfigColumns.some((c) => c.name === 'description')) {
    sqlite.exec("ALTER TABLE server_configs ADD COLUMN description TEXT NOT NULL DEFAULT '';");
  }

  const templateColumns = sqlite
    .prepare("PRAGMA table_info('server_start_templates')")
    .all() as Array<{ name: string }>;

  if (!templateColumns.some((c) => c.name === 'runtime_id')) {
    sqlite.exec("ALTER TABLE server_start_templates ADD COLUMN runtime_id TEXT NOT NULL DEFAULT '';");
  }
  if (!templateColumns.some((c) => c.name === 'template_group')) {
    sqlite.exec("ALTER TABLE server_start_templates ADD COLUMN template_group TEXT NOT NULL DEFAULT '';");
  }
  if (!templateColumns.some((c) => c.name === 'template_description')) {
    sqlite.exec("ALTER TABLE server_start_templates ADD COLUMN template_description TEXT NOT NULL DEFAULT '';");
  }

  const metricColumns = sqlite
    .prepare("PRAGMA table_info('metric_snapshots')")
    .all() as Array<{ name: string }>;

  if (!metricColumns.some((c) => c.name === 'max_memory_mb')) {
    sqlite.exec('ALTER TABLE metric_snapshots ADD COLUMN max_memory_mb REAL;');
  }
  if (!metricColumns.some((c) => c.name === 'world_count')) {
    sqlite.exec('ALTER TABLE metric_snapshots ADD COLUMN world_count INTEGER;');
  }
  if (!metricColumns.some((c) => c.name === 'max_players')) {
    sqlite.exec('ALTER TABLE metric_snapshots ADD COLUMN max_players INTEGER;');
  }
  if (!metricColumns.some((c) => c.name === 'plugin_count')) {
    sqlite.exec('ALTER TABLE metric_snapshots ADD COLUMN plugin_count INTEGER;');
  }
  if (!metricColumns.some((c) => c.name === 'player_details')) {
    sqlite.exec('ALTER TABLE metric_snapshots ADD COLUMN player_details TEXT;');
  }
  if (!metricColumns.some((c) => c.name === 'plugin_details')) {
    sqlite.exec('ALTER TABLE metric_snapshots ADD COLUMN plugin_details TEXT;');
  }

  const fileTasksTableExists = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='file_tasks' LIMIT 1")
    .get() as { 1: number } | undefined;

  if (fileTasksTableExists) {
    const fileTaskColumns = sqlite
      .prepare("PRAGMA table_info('file_tasks')")
      .all() as Array<{ name: string }>;

    if (!fileTaskColumns.some((c) => c.name === 'attempt')) {
      sqlite.exec('ALTER TABLE file_tasks ADD COLUMN attempt INTEGER NOT NULL DEFAULT 1;');
    }
    if (!fileTaskColumns.some((c) => c.name === 'max_attempts')) {
      sqlite.exec('ALTER TABLE file_tasks ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 1;');
    }
    if (!fileTaskColumns.some((c) => c.name === 'retryable')) {
      sqlite.exec('ALTER TABLE file_tasks ADD COLUMN retryable INTEGER NOT NULL DEFAULT 0;');
    }
    if (!fileTaskColumns.some((c) => c.name === 'resume_token')) {
      sqlite.exec('ALTER TABLE file_tasks ADD COLUMN resume_token TEXT;');
    }
    if (!fileTaskColumns.some((c) => c.name === 'failure_class')) {
      sqlite.exec('ALTER TABLE file_tasks ADD COLUMN failure_class TEXT;');
    }
  }
}
