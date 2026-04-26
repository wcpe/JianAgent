import { Globe, Server, ShieldCheck } from 'lucide-react';
import type { LauncherMode } from './resource-helpers.js';

interface ResourceOnboardingLauncherProps {
  readonly onClose: () => void;
  readonly onSelect: (mode: Exclude<LauncherMode, null>) => void;
}

export function ResourceOnboardingLauncher({
  onClose,
  onSelect,
}: ResourceOnboardingLauncherProps) {
  const options: Array<{
    mode: Exclude<LauncherMode, null>;
    title: string;
    description: string;
    icon: typeof Server;
  }> = [
    {
      mode: 'managed-existing',
      title: '托管服务器 / 纳管现有目录',
      description: '接管已经准备好的本地服务器目录。',
      icon: Server,
    },
    {
      mode: 'managed-paper',
      title: '托管服务器 / 初始化新 Paper 工作区',
      description: '创建新的托管服务器配置并准备 Paper 工作区。',
      icon: Server,
    },
    {
      mode: 'external-server',
      title: '外置服务器 / 纳管运行中地址',
      description: '以地址和端口纳管已运行的 Minecraft 服务器。',
      icon: ShieldCheck,
    },
    {
      mode: 'remote-host',
      title: '远程主机 / SSH 接入',
      description: '通过 SSH 接入远程主机，纳入统一资源工作台。',
      icon: Globe,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-4xl rounded-3xl border border-white/60 bg-white/90 p-6 shadow-2xl backdrop-blur-xl dark:border-primary-300/20 dark:bg-gray-950/90">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
              Resource Onboarding
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              选择资源接入路径
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            关闭
          </button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {options.map((option) => (
            <button
              key={option.mode}
              onClick={() => onSelect(option.mode)}
              className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-primary-50 p-3 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
                  <option.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {option.title}
                  </div>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {option.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
