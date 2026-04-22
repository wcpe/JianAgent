import { type FC, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { executeWhitelistAction } from '../../api/whitelist-action.api.js';
import type { WhitelistActionResult } from '@jian-agent/shared-domain';

interface ActionDef {
  readonly name: string;
  readonly label: string;
  readonly fields: readonly { key: string; label: string; type: 'text' | 'number' }[];
}

const ACTIONS: readonly ActionDef[] = [
  {
    name: 'teleport',
    label: '传送',
    fields: [
      { key: 'target', label: '目标玩家', type: 'text' },
      { key: 'x', label: 'X', type: 'number' },
      { key: 'y', label: 'Y', type: 'number' },
      { key: 'z', label: 'Z', type: 'number' },
      { key: 'world', label: '世界', type: 'text' },
    ],
  },
  {
    name: 'give_equipment',
    label: '发放装备',
    fields: [
      { key: 'target', label: '目标玩家', type: 'text' },
      { key: 'preset', label: '预设 (iron/diamond)', type: 'text' },
    ],
  },
  {
    name: 'reset_map',
    label: '重置地图',
    fields: [{ key: 'worldName', label: '世界名', type: 'text' }],
  },
  {
    name: 'countdown',
    label: '倒计时',
    fields: [{ key: 'seconds', label: '秒数', type: 'number' }],
  },
  { name: 'force_start', label: '强制开局', fields: [] },
  { name: 'stop_game', label: '停止战局', fields: [] },
];

interface Props {
  readonly serverId?: string;
}

const WhitelistActionPanel: FC<Props> = ({ serverId: serverIdProp }) => {
  const [searchParams] = useSearchParams();
  const serverId = serverIdProp ?? searchParams.get('serverId') ?? '';
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [result, setResult] = useState<WhitelistActionResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleToggle = useCallback((name: string) => {
    setExpanded((prev) => (prev === name ? null : name));
    setFormData({});
    setResult(null);
  }, []);

  const handleChange = useCallback((key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleExecute = useCallback(
    async (action: ActionDef) => {
      setLoading(true);
      setResult(null);
      try {
        const params: Record<string, unknown> = {};
        for (const f of action.fields) {
          const raw = formData[f.key] ?? '';
          params[f.key] = f.type === 'number' ? Number(raw) : raw;
        }
        const res = await executeWhitelistAction(serverId, {
          action: action.name,
          params,
        });
        setResult(res.data);
      } catch (err) {
        setResult({
          action: action.name,
          success: false,
          message: String(err),
          timestamp: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    },
    [serverId, formData],
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">白名单动作面板</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ACTIONS.map((action) => (
          <div
            key={action.name}
            className="border rounded-lg p-4 bg-white dark:bg-zinc-900 shadow-sm"
          >
            <button
              type="button"
              className="w-full text-left font-medium text-blue-600 dark:text-blue-400 hover:underline"
              onClick={() => handleToggle(action.name)}
            >
              {action.label}
            </button>

            {expanded === action.name && (
              <div className="mt-3 space-y-2">
                {action.fields.map((f) => (
                  <label key={f.key} className="block text-sm">
                    <span className="block text-zinc-500 dark:text-zinc-400">{f.label}</span>
                    <input
                      type={f.type}
                      className="mt-1 w-full rounded border px-2 py-1 text-sm dark:bg-zinc-800 dark:border-zinc-700"
                      value={formData[f.key] ?? ''}
                      onChange={(e) => handleChange(f.key, e.target.value)}
                    />
                  </label>
                ))}

                <button
                  type="button"
                  disabled={loading}
                  className="w-full mt-2 rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                  onClick={() => handleExecute(action)}
                >
                  {loading ? '执行中...' : '执行'}
                </button>

                {result && result.action === action.name && (
                  <div
                    className={`mt-2 rounded p-2 text-sm ${
                      result.success
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}
                  >
                    {result.success ? '✔' : '✘'} {result.message}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WhitelistActionPanel;
