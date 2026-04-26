import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FileDown, Package, ChevronRight, ChevronLeft, Check, Circle, Loader2, X, Server, ExternalLink } from 'lucide-react';
import { Modal } from '../../components/ui/Modal.js';
import { ErrorAlert } from '../../components/ui/ErrorAlert.js';
import { serverApi } from '../../api/server.api.js';
import { javaRuntimeApi } from '../../api/java-runtime.api.js';
import { useServerStore } from '../../stores/server.store.js';
import { useWsChannel } from '../../ws/use-ws-channel.js';
import type { PaperVersionInfo, ProvisionPhase } from '@jian-agent/shared-domain';

interface ServerSetupWizardProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

type CoreType = 'paper' | 'custom';

const MEMORY_OPTIONS = ['512M', '1G', '2G', '4G', '6G', '8G'] as const;

const PROVISION_PHASES: { key: ProvisionPhase; i18nKey: string }[] = [
  { key: 'VALIDATING', i18nKey: 'phaseValidating' },
  { key: 'CREATING_DIRECTORY', i18nKey: 'phaseCreatingDir' },
  { key: 'DOWNLOADING_CORE', i18nKey: 'phaseDownloading' },
  { key: 'WRITING_CONFIG', i18nKey: 'phaseWritingConfig' },
  { key: 'CREATING_SERVER', i18nKey: 'phaseCreatingServer' },
  { key: 'STARTING', i18nKey: 'phaseStarting' },
];

export function ServerSetupWizard({ open, onClose }: ServerSetupWizardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fetchServers = useServerStore((s) => s.fetchServers);

  // Wizard state
  const [step, setStep] = useState(0);

  // Step 1: Core selection
  const [coreType, setCoreType] = useState<CoreType>('paper');
  const [paperVersions, setPaperVersions] = useState<PaperVersionInfo[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [customJarPath, setCustomJarPath] = useState('');

  // Step 2: Config
  const [serverName, setServerName] = useState('');
  const [workDir, setWorkDir] = useState('');
  const [port, setPort] = useState(25565);
  const [maxMemory, setMaxMemory] = useState('2G');
  const [minMemory, setMinMemory] = useState('512M');
  const [runtimeId, setRuntimeId] = useState('');
  const [runtimes, setRuntimes] = useState<readonly { id: string; name: string; version: string; isDefault: boolean }[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [jvmArgs, setJvmArgs] = useState('');
  const [serverArgs, setServerArgs] = useState('');
  const [serverGroup, setServerGroup] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');

  // Step 3: Provision progress
  const [agreeEula, setAgreeEula] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<ProvisionPhase | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [provisionSuccess, setProvisionSuccess] = useState(false);
  const [createdServerId, setCreatedServerId] = useState('');

  // Load Paper versions when modal opens
  useEffect(() => {
    if (!open) return;
    setLoadingVersions(true);
    serverApi.listPaperVersions()
      .then((versions) => {
        const list = Array.isArray(versions) ? versions : [];
        setPaperVersions(list);
        if (list.length > 0 && !selectedVersion) {
          setSelectedVersion(list[0].version);
        }
      })
      .catch(() => setPaperVersions([]))
      .finally(() => setLoadingVersions(false));

    javaRuntimeApi.findAll()
      .then((rts) => setRuntimes(Array.isArray(rts) ? rts : []))
      .catch(() => setRuntimes([]));
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(0);
      setProvisioning(false);
      setProvisionSuccess(false);
      setProvisionError(null);
      setCurrentPhase(null);
      setProgress(0);
    }
  }, [open]);

  // Auto-generate name and workDir when version or core type changes
  useEffect(() => {
    if (coreType === 'paper' && selectedVersion && !serverName) {
      setServerName(`Paper-${selectedVersion}`);
    }
  }, [coreType, selectedVersion]);

  useEffect(() => {
    if (serverName && !workDir) {
      setWorkDir(`/opt/minecraft-servers/${serverName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`);
    }
  }, [serverName]);

  // WebSocket provision progress
  const handleProvisionProgress = useCallback((data: any) => {
    const payload = data?.payload ?? data;
    if (!payload) return;
    setCurrentPhase(payload.phase);
    setProgress(payload.progress ?? 0);
    setProgressMessage(payload.message ?? '');
    if (payload.phase === 'READY') {
      setProvisionSuccess(true);
      setProvisioning(false);
      fetchServers();
    }
    if (payload.phase === 'FAILED') {
      setProvisionError(payload.error ?? payload.message ?? '创建失败');
      setProvisioning(false);
    }
    if (payload.serverId && !createdServerId) {
      setCreatedServerId(payload.serverId);
    }
  }, [fetchServers, createdServerId]);

  useWsChannel('task:server:provision:progress', handleProvisionProgress);

  const canNext = () => {
    if (step === 0) {
      return coreType === 'paper' ? !!selectedVersion : !!customJarPath.trim();
    }
    if (step === 1) {
      return !!serverName.trim() && !!workDir.trim();
    }
    return true;
  };

  const handleProvision = async () => {
    setProvisioning(true);
    setProvisionError(null);
    setProvisionSuccess(false);
    setCurrentPhase(null);
    setProgress(0);

    try {
      const result = await serverApi.provisionServer({
        name: serverName.trim(),
        coreType,
        minecraftVersion: coreType === 'paper' ? selectedVersion : undefined,
        jarPath: coreType === 'custom' ? customJarPath.trim() : undefined,
        workDir: workDir.trim(),
        port,
        maxMemory,
        minMemory,
        runtimeId: runtimeId || undefined,
        autoStart: true,
        agreeEula,
        jvmArgs: jvmArgs.trim() ? jvmArgs.split(/\s+/).filter(Boolean) : undefined,
        serverArgs: serverArgs.trim() ? serverArgs.split(/\s+/).filter(Boolean) : undefined,
        serverGroup: serverGroup.trim() || undefined,
        tags: tags.trim() ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        description: description.trim() || undefined,
      });
      setCreatedServerId(result.serverId);
      setProvisionSuccess(true);
      setProvisioning(false);
      setCurrentPhase('READY');
      setProgress(100);
      fetchServers();
    } catch (err: any) {
      setProvisionError(err.message ?? '创建失败');
      setProvisioning(false);
    }
  };

  const inputClass = 'w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/30';
  const labelClass = 'block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5';

  const getPhaseStatus = (phaseKey: ProvisionPhase): 'pending' | 'active' | 'done' | 'error' => {
    if (!currentPhase) return 'pending';
    if (currentPhase === 'FAILED') {
      const idx = PROVISION_PHASES.findIndex((p) => p.key === phaseKey);
      const currentIdx = PROVISION_PHASES.findIndex((p) => p.key === currentPhase);
      if (idx < currentIdx) return 'done';
      return 'error';
    }
    const phases = PROVISION_PHASES.map((p) => p.key);
    const currentIdx = phases.indexOf(currentPhase);
    const phaseIdx = phases.indexOf(phaseKey);
    if (phaseIdx < currentIdx) return 'done';
    if (phaseIdx === currentIdx) return currentPhase === 'READY' ? 'done' : 'active';
    return 'pending';
  };

  const renderStep0 = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {t('serverSetup.stepCore')}
      </p>
      <div className="grid grid-cols-2 gap-4">
        {/* Paper card */}
        <button
          type="button"
          onClick={() => setCoreType('paper')}
          className={`relative p-5 rounded-2xl border-2 text-left transition-all ${
            coreType === 'paper'
              ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20 shadow-lg shadow-primary-500/10'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          {coreType === 'paper' && (
            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
              <Check size={12} className="text-white" />
            </div>
          )}
          <FileDown size={28} className={`mb-3 ${coreType === 'paper' ? 'text-primary-500' : 'text-gray-400'}`} />
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('serverSetup.corePaper')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('serverSetup.corePaperDesc')}</p>
        </button>

        {/* Custom JAR card */}
        <button
          type="button"
          onClick={() => setCoreType('custom')}
          className={`relative p-5 rounded-2xl border-2 text-left transition-all ${
            coreType === 'custom'
              ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20 shadow-lg shadow-primary-500/10'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          {coreType === 'custom' && (
            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
              <Check size={12} className="text-white" />
            </div>
          )}
          <Package size={28} className={`mb-3 ${coreType === 'custom' ? 'text-primary-500' : 'text-gray-400'}`} />
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('serverSetup.coreCustom')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('serverSetup.coreCustomDesc')}</p>
        </button>
      </div>

      {/* Core-specific config */}
      <div className="mt-4">
        {coreType === 'paper' && (
          <div>
            <label className={labelClass}>{t('serverSetup.selectVersion')}</label>
            {loadingVersions ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 size={14} className="animate-spin" />
                {t('serverSetup.loadingVersions')}
              </div>
            ) : (
              <select
                value={selectedVersion}
                onChange={(e) => {
                  setSelectedVersion(e.target.value);
                  setServerName(`Paper-${e.target.value}`);
                  setWorkDir('');
                }}
                className={inputClass}
              >
                {paperVersions.map((v) => (
                  <option key={v.version} value={v.version}>
                    Minecraft {v.version}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        {coreType === 'custom' && (
          <div>
            <label className={labelClass}>{t('serverSetup.jarPath')}</label>
            <input
              value={customJarPath}
              onChange={(e) => setCustomJarPath(e.target.value)}
              placeholder={t('serverSetup.jarPathPlaceholder')}
              className={inputClass}
            />
          </div>
        )}
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>{t('serverSetup.serverName')} *</label>
        <input value={serverName} onChange={(e) => setServerName(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>{t('serverSetup.workDir')} *</label>
        <input
          value={workDir}
          onChange={(e) => setWorkDir(e.target.value)}
          placeholder={t('serverSetup.workDirPlaceholder')}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>{t('serverSetup.port')}</label>
          <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('serverSetup.maxMemory')}</label>
          <select value={maxMemory} onChange={(e) => setMaxMemory(e.target.value)} className={inputClass}>
            {MEMORY_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t('serverSetup.minMemory')}</label>
          <select value={minMemory} onChange={(e) => setMinMemory(e.target.value)} className={inputClass}>
            {MEMORY_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>{t('serverSetup.javaRuntime')}</label>
        <select value={runtimeId} onChange={(e) => setRuntimeId(e.target.value)} className={inputClass}>
          <option value="">{t('serverSetup.javaRuntimeAuto')}</option>
          {runtimes.map((rt) => (
            <option key={rt.id} value={rt.id}>
              {rt.name} (Java {rt.version})
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
      >
        {t('serverSetup.advancedConfig')} {showAdvanced ? '\u25B2' : '\u25BC'}
      </button>

      {showAdvanced && (
        <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
          <div>
            <label className={labelClass}>{t('serverSetup.jvmArgs')}</label>
            <input value={jvmArgs} onChange={(e) => setJvmArgs(e.target.value)} placeholder="-XX:+UseG1GC" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t('serverSetup.serverArgs')}</label>
            <input value={serverArgs} onChange={(e) => setServerArgs(e.target.value)} placeholder="nogui" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('serverSetup.group')}</label>
              <input value={serverGroup} onChange={(e) => setServerGroup(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('serverSetup.tags')}</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t('serverSetup.description')}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} />
          </div>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => {
    if (provisioning || provisionSuccess || provisionError) {
      return (
        <div className="space-y-3">
          {/* Progress phases */}
          <div className="space-y-2">
            {PROVISION_PHASES.map((phase) => {
              const status = getPhaseStatus(phase.key);
              return (
                <div key={phase.key} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50/50 dark:bg-gray-800/30">
                  {status === 'done' && <Check size={16} className="text-success-500 shrink-0" />}
                  {status === 'active' && <Loader2 size={16} className="text-primary-500 animate-spin shrink-0" />}
                  {status === 'pending' && <Circle size={16} className="text-gray-300 dark:text-gray-600 shrink-0" />}
                  {status === 'error' && <X size={16} className="text-danger-500 shrink-0" />}
                  <span className={`text-sm ${
                    status === 'active' ? 'text-primary-600 dark:text-primary-400 font-medium' :
                    status === 'done' ? 'text-gray-600 dark:text-gray-400' :
                    status === 'error' ? 'text-danger-600 dark:text-danger-400' :
                    'text-gray-400 dark:text-gray-500'
                  }`}>
                    {t(`serverSetup.${phase.i18nKey}`)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          {provisioning && (
            <div className="mt-3">
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">{progressMessage}</p>
            </div>
          )}

          {/* Error */}
          {provisionError && <ErrorAlert message={provisionError} />}

          {/* Success */}
          {provisionSuccess && (
            <div className="mt-3 p-4 rounded-xl bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-700/40 text-center">
              <Server size={32} className="text-success-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-success-700 dark:text-success-300">{t('serverSetup.successMessage')}</p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (createdServerId) {
                    navigate(`/resources/${createdServerId}/overview`);
                  }
                }}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-success-600 text-white rounded-xl text-sm hover:bg-success-700 transition-colors"
              >
                <ExternalLink size={14} />
                {t('serverSetup.openServer')}
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-sm text-gray-500">{t('serverSetup.summaryCore')}</span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {coreType === 'paper' ? `Paper ${selectedVersion}` : t('serverSetup.coreCustom')}
            </span>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-sm text-gray-500">{t('serverSetup.serverName')}</span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{serverName}</span>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-sm text-gray-500">{t('serverSetup.summaryDir')}</span>
            <span className="text-sm font-mono text-gray-800 dark:text-gray-200 truncate max-w-[300px]">{workDir}</span>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-sm text-gray-500">{t('serverSetup.summaryPort')}</span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{port}</span>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-sm text-gray-500">{t('serverSetup.summaryMemory')}</span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{minMemory} ~ {maxMemory}</span>
          </div>
        </div>

        {/* EULA */}
        <label className="flex items-start gap-3 p-3 rounded-xl bg-warning-50/50 dark:bg-warning-900/10 border border-warning-200 dark:border-warning-700/30 cursor-pointer">
          <input
            type="checkbox"
            checked={agreeEula}
            onChange={(e) => setAgreeEula(e.target.checked)}
            className="mt-0.5 rounded"
          />
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t('serverSetup.agreeEula')}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('serverSetup.eulaHint')}</p>
          </div>
        </label>
      </div>
    );
  };

  const stepTitles = [t('serverSetup.stepCore'), t('serverSetup.stepConfig'), t('serverSetup.stepConfirm')];

  const footer = provisioning || provisionSuccess ? null : (
    <div className="flex items-center justify-between">
      <div>
        {step > 0 && !provisionError && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <ChevronLeft size={16} />
            {t('serverSetup.prev')}
          </button>
        )}
        {provisionError && (
          <button
            type="button"
            onClick={() => { setProvisionError(null); setCurrentPhase(null); }}
            className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <ChevronLeft size={16} />
            {t('serverSetup.prev')}
          </button>
        )}
      </div>
      <div>
        {step < 2 && (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            disabled={!canNext()}
            className="flex items-center gap-1 px-5 py-2 bg-primary-600 text-white rounded-xl text-sm hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t('serverSetup.next')}
            <ChevronRight size={16} />
          </button>
        )}
        {step === 2 && !provisionError && (
          <button
            type="button"
            onClick={handleProvision}
            disabled={!agreeEula}
            className="flex items-center gap-1 px-5 py-2 bg-primary-600 text-white rounded-xl text-sm hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t('serverSetup.createAndStart')}
          </button>
        )}
        {provisionError && (
          <button
            type="button"
            onClick={handleProvision}
            className="flex items-center gap-1 px-5 py-2 bg-primary-600 text-white rounded-xl text-sm hover:bg-primary-700 transition-colors"
          >
            {t('serverSetup.createAndStart')}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Modal open={open} onClose={provisioning ? () => {} : onClose} title={t('serverSetup.title')} size="lg" footer={footer}>
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {stepTitles.map((title, i) => (
          <div key={title} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              i === step
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : i < step
                ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
            }`}>
              {i < step ? <Check size={12} /> : <span>{i + 1}</span>}
              <span>{title}</span>
            </div>
            {i < stepTitles.length - 1 && (
              <ChevronRight size={14} className="text-gray-300 dark:text-gray-600" />
            )}
          </div>
        ))}
      </div>

      {step === 0 && renderStep0()}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
    </Modal>
  );
}
