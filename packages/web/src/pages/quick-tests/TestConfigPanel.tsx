import { useState, useEffect } from 'react';
import { StyledSelect } from '../../components/ui/StyledSelect.js';
import { useSearchParams } from 'react-router-dom';
import { useServerStore } from '../../stores/server.store.js';
import { useQuickTestStore, type TestConfig } from '../../stores/quick-test.store.js';

interface TestConfigPanelProps {
  readonly disabled: boolean;
}

export function TestConfigPanel({ disabled }: TestConfigPanelProps) {
  const [params] = useSearchParams();
  const servers = useServerStore((s) => s.servers);
  const startTest = useQuickTestStore((s) => s.startTest);

  const runningServers = servers.filter((s) => s.runtimeStatus === 'running');

  const [serverId, setServerId] = useState(params.get('serverId') ?? '');
  const [botCount, setBotCount] = useState(10);
  const [namePrefix, setNamePrefix] = useState('test-bot');
  const [behavior, setBehavior] = useState('idle');
  const [durationMinutes, setDurationMinutes] = useState(0);

  useEffect(() => {
    const qsId = params.get('serverId');
    if (qsId && runningServers.some((s) => s.id === qsId)) {
      setServerId(qsId);
    }
  }, [params, runningServers]);

  const handleStart = () => {
    if (!serverId) return;
    const config: TestConfig = { serverId, botCount, namePrefix, behavior, durationMinutes };
    const server = servers.find((s) => s.id === serverId);
    startTest(config, server?.name ?? '');
  };

  if (runningServers.length === 0) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 text-sm text-yellow-700 dark:text-yellow-300">
        没有运行中的服务器，请先启动一台
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800/50 shadow-sm dark:shadow-none rounded-lg p-5 space-y-4">
      <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">测试配置</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">目标服务器</label>
          <StyledSelect
            disabled={disabled}
            className="w-full"
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
          >
            <option value="">选择服务器</option>
            {runningServers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </StyledSelect>
        </div>

        <div>
          <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">机器人数量</label>
          <input
            type="number"
            min={1}
            max={50}
            disabled={disabled}
            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm text-gray-800 dark:text-gray-200 disabled:opacity-50"
            value={botCount}
            onChange={(e) => setBotCount(parseInt(e.target.value, 10) || 1)}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">名称前缀</label>
          <input
            type="text"
            disabled={disabled}
            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm text-gray-800 dark:text-gray-200 disabled:opacity-50"
            value={namePrefix}
            onChange={(e) => setNamePrefix(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">行为模板</label>
          <StyledSelect
            disabled={disabled}
            className="w-full"
            value={behavior}
            onChange={(e) => setBehavior(e.target.value)}
          >
            <option value="idle">idle — 静止</option>
            <option value="walk_random">walk_random — 随机行走</option>
            <option value="chat_spam">chat_spam — 聊天刷屏</option>
            <option value="patrol">patrol — 巡逻</option>
            <option value="follow">follow — 跟随</option>
            <option value="combat">combat — 战斗</option>
            <option value="build">build — 建造</option>
            <option value="mine">mine — 挖矿</option>
            <option value="pvp">pvp — 玩家对战</option>
            <option value="explore">explore — 探索</option>
          </StyledSelect>
        </div>

        <div>
          <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">持续时长（分钟, 0=手动）</label>
          <input
            type="number"
            min={0}
            max={120}
            disabled={disabled}
            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm text-gray-800 dark:text-gray-200 disabled:opacity-50"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 0)}
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            disabled={disabled || !serverId}
            onClick={handleStart}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm rounded px-6 py-2 font-medium"
          >
            开始测试
          </button>
        </div>
      </div>
    </div>
  );
}
