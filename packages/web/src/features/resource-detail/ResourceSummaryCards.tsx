import { useNavigate } from 'react-router-dom';
import type { ResourceDetailDto } from '@jian-agent/shared-domain';
import { remoteHostApi } from '../../api/remote-host.api.js';
import { serverApi } from '../../api/server.api.js';
import { useDialogStore } from '../../stores/dialog.store.js';

function formatUptime(sec: number | null): string {
  if (sec == null) return '-';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface CardProps {
  readonly label: string;
  readonly value: string;
  readonly sub?: string;
}

function SummaryCard({ label, value, sub }: CardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-400">{sub}</div> : null}
    </div>
  );
}

export interface ResourceSummaryCardsProps {
  detail: ResourceDetailDto;
}

export function ResourceSummaryCards({ detail }: ResourceSummaryCardsProps) {
  const navigate = useNavigate();
  const { status, capabilities } = detail;

  const cards: CardProps[] = [
    { label: '状态', value: status.state, sub: status.detail ?? undefined },
    { label: '健康', value: status.health },
    { label: '运行时间', value: formatUptime(status.uptimeSec) },
  ];

  if (detail.host) {
    cards.push({
      label: '地址',
      value: `${detail.host}${detail.port ? `:${detail.port}` : ''}`,
    });
  }

  if (status.onlinePlayers != null && status.maxPlayers != null) {
    cards.push({
      label: '在线玩家',
      value: `${status.onlinePlayers}`,
      sub: `/ ${status.maxPlayers}`,
    });
  }

  if (detail.latestValidationSummary) {
    cards.push({
      label: '最近验证',
      value: detail.latestValidationSummary.verdict,
      sub: detail.latestValidationSummary.finishedAt
        ? new Date(detail.latestValidationSummary.finishedAt).toLocaleString('zh-CN')
        : detail.latestValidationSummary.state,
    });
  }

  if (capabilities.plugins.enabled) {
    cards.push({
      label: '插件',
      value: `${capabilities.plugins.pluginCount}`,
    });
  }

  if (capabilities.monitoring.enabled) {
    cards.push({
      label: '监控状态',
      value: capabilities.monitoring.probeActive ? '探针活跃' : '基础监控',
      sub: `告警规则 ${capabilities.monitoring.alertRuleCount}`,
    });
  }

  const handleAction = async (key: string) => {
    try {
      switch (key) {
        case 'start':
          await serverApi.startServer(detail.id);
          break;
        case 'stop':
          await serverApi.stopServer(detail.id);
          break;
        case 'restart':
          await serverApi.restartServer(detail.id);
          break;
        case 'interrupt':
          await serverApi.interruptServer(detail.id);
          break;
        case 'delete':
          if (detail.kind === 'REMOTE_HOST') {
            await remoteHostApi.delete(detail.id);
            navigate('/resources');
            return;
          }
          await serverApi.deleteServer(detail.id);
          navigate('/resources');
          return;
        case 'ping':
          await serverApi.pingServer(detail.id);
          break;
        case 'test-connection':
          await remoteHostApi.testConnection(detail.id);
          break;
        case 'terminal':
        case 'ssh-terminal':
          navigate(`/resources/${detail.id}/terminal`);
          return;
        case 'files':
          navigate(`/resources/${detail.id}/files`);
          return;
        case 'validation':
        case 'validation-view':
          navigate(`/resources/${detail.id}/validation`);
          return;
        default:
          return;
      }
      window.location.reload();
    } catch (error: any) {
      useDialogStore
        .getState()
        .showToast(error.message ?? '动作执行失败', 'error');
    }
  };

  return (
    <div className="space-y-4 p-4">
      <section className="rounded-3xl border border-white/60 bg-white/85 p-5 shadow-xl backdrop-blur-xl dark:border-primary-300/20 dark:bg-slate-950/70">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
          Overview
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {detail.name}
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {detail.serverType === 'external'
            ? '外置服务器通过统一资源面板纳管，当前不暴露托管控制能力。'
            : detail.kind === 'REMOTE_HOST'
              ? '远程主机在统一工作台中以 SSH 可观测资源呈现。'
              : '托管服务器已接入统一资源详情，动作、验证和状态从同一读模型派生。'}
        </p>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <SummaryCard key={`${card.label}:${card.value}`} {...card} />
        ))}
      </div>

      <section className="rounded-3xl border border-white/60 bg-white/85 p-5 shadow-xl backdrop-blur-xl dark:border-primary-300/20 dark:bg-slate-950/70">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Actions
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              当前可用动作
            </h2>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {detail.availableActions.map((action) => (
            <button
              key={action.key}
              onClick={() => void handleAction(action.key)}
              disabled={!action.enabled}
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              title={action.reason ?? action.label}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
