import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WsChannel } from '@jian-agent/shared-protocol';
import { useWsChannel } from '../../ws/use-ws-channel.js';
import { useLocalValidationStore } from './local-validation.store.js';
import { LocalValidationAssertionPanel } from './LocalValidationAssertionPanel.js';
import { LocalValidationEvidenceDrawer } from './LocalValidationEvidenceDrawer.js';
import { LocalValidationRunBuilder } from './LocalValidationRunBuilder.js';
import { LocalValidationStageTimeline } from './LocalValidationStageTimeline.js';
import { ErrorAlert } from '../../components/ui/ErrorAlert.js';

type BuilderStatus = 'idle' | 'creating' | 'starting' | 'cancelling';

export function LocalValidationPage() {
  const [searchParams] = useSearchParams();
  const preselectedServerId = searchParams.get('serverId');
  const scenarioPacks = useLocalValidationStore((state) => state.scenarioPacks);
  const runs = useLocalValidationStore((state) => state.runs);
  const activeRun = useLocalValidationStore((state) => state.activeRun);
  const stages = useLocalValidationStore((state) => state.stages);
  const assertions = useLocalValidationStore((state) => state.assertions);
  const evidence = useLocalValidationStore((state) => state.evidence);
  const selectedRunId = useLocalValidationStore((state) => state.selectedRunId);
  const loading = useLocalValidationStore((state) => state.loading);
  const error = useLocalValidationStore((state) => state.error);
  const loadScenarioPacks = useLocalValidationStore((state) => state.loadScenarioPacks);
  const loadRuns = useLocalValidationStore((state) => state.loadRuns);
  const selectRun = useLocalValidationStore((state) => state.selectRun);
  const createRun = useLocalValidationStore((state) => state.createRun);
  const startRun = useLocalValidationStore((state) => state.startRun);
  const cancelRun = useLocalValidationStore((state) => state.cancelRun);
  const loadRunArtifacts = useLocalValidationStore((state) => state.loadRunArtifacts);

  const [builderStatus, setBuilderStatus] = useState<BuilderStatus>('idle');

  useEffect(() => {
    void loadScenarioPacks();
    void loadRuns();
  }, [loadScenarioPacks, loadRuns]);

  useEffect(() => {
    if (!selectedRunId) {
      return;
    }
    void loadRunArtifacts(selectedRunId);
  }, [loadRunArtifacts, selectedRunId]);

  const refreshSelectedRunArtifacts = useCallback(async (runId: string | null | undefined) => {
    if (!runId) {
      return;
    }
    await selectRun(runId);
    await loadRunArtifacts(runId);
  }, [loadRunArtifacts, selectRun]);

  const handleRunEvent = useCallback((payload: { readonly runId?: string }) => {
    void loadRuns();
    if (!payload.runId || payload.runId !== selectedRunId) {
      return;
    }
    void refreshSelectedRunArtifacts(payload.runId);
  }, [loadRuns, refreshSelectedRunArtifacts, selectedRunId]);

  const handleArtifactEvent = useCallback((payload: { readonly runId?: string }) => {
    if (!payload.runId || payload.runId !== selectedRunId) {
      return;
    }
    void loadRunArtifacts(payload.runId);
  }, [loadRunArtifacts, selectedRunId]);

  useWsChannel(WsChannel.RESOURCE_LOCAL_VALIDATION_RUN, handleRunEvent);
  useWsChannel(WsChannel.RESOURCE_LOCAL_VALIDATION_STAGE, handleArtifactEvent);
  useWsChannel(WsChannel.RESOURCE_LOCAL_VALIDATION_ASSERTION, handleArtifactEvent);
  useWsChannel(WsChannel.RESOURCE_LOCAL_VALIDATION_EVIDENCE, handleArtifactEvent);

  return (
    <div data-testid="local-validation-page" className="grid gap-4 p-6 xl:grid-cols-[360px_minmax(0,1fr)_380px]">
      <LocalValidationRunBuilder
        scenarioPacks={scenarioPacks}
        runs={runs}
        selectedRunId={selectedRunId}
        loadingRuns={loading.runs}
        status={builderStatus}
        onSelectRun={refreshSelectedRunArtifacts}
        onCreateRun={async (input) => {
          setBuilderStatus('creating');
          try {
            const run = await createRun({
              name: input.name,
              mode: 'init-paper',
              paperVersion: input.paperVersion,
              scenarioPackId: input.scenarioPackId,
              requestedBotCount: input.requestedBotCount,
              keepServerRunning: input.keepServerRunning,
              keepWorkspace: input.keepWorkspace,
            });
            await loadRuns();
            await refreshSelectedRunArtifacts(run.id);
          } finally {
            setBuilderStatus('idle');
          }
        }}
        onStartRun={async (runId) => {
          setBuilderStatus('starting');
          try {
            await startRun(runId);
            await loadRuns();
            await refreshSelectedRunArtifacts(runId);
          } finally {
            setBuilderStatus('idle');
          }
        }}
        onCancelRun={async (runId) => {
          setBuilderStatus('cancelling');
          try {
            await cancelRun(runId);
            await loadRuns();
            await refreshSelectedRunArtifacts(runId);
          } finally {
            setBuilderStatus('idle');
          }
        }}
      />

      <div className="grid gap-4">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
            Local Validation
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">本地验证运行台</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            打通本地 Paper 测试服、机器人验收包、断言结果和运行证据的一站式验证工作台。
          </p>
          {preselectedServerId ? (
            <div className="mt-4 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-700 dark:border-primary-900/40 dark:bg-primary-900/20 dark:text-primary-200">
              已从资源详情携带服务器上下文进入：{preselectedServerId}
            </div>
          ) : null}
          {error ? <ErrorAlert message={error} className="mt-4" /> : null}
        </section>

        <LocalValidationStageTimeline
          run={activeRun}
          stages={stages}
          loading={loading.activeRun || loading.artifacts}
        />
        <LocalValidationAssertionPanel
          run={activeRun}
          assertions={assertions}
          loading={loading.activeRun || loading.artifacts}
        />
      </div>

      <LocalValidationEvidenceDrawer
        run={activeRun}
        evidence={evidence}
        loading={loading.activeRun || loading.artifacts}
      />
    </div>
  );
}
