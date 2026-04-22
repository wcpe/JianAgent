import { type FC, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  listBotGroups,
  createBotGroup,
  deleteBotGroup,
  addBotsToGroup,
  removeBotsFromGroup,
  applyBehaviorToGroup,
  listBehaviorTemplates,
} from '../../api/bot-group.api.js';
import type { BotGroupDto, BehaviorTemplateDto } from '@jian-agent/shared-domain';

interface Props {
  readonly sessionId?: string;
}

const BotGroupPanel: FC<Props> = ({ sessionId: sessionIdProp }) => {
  const [searchParams] = useSearchParams();
  const sessionId = sessionIdProp ?? searchParams.get('sessionId') ?? '';
  const [groups, setGroups] = useState<readonly BotGroupDto[]>([]);
  const [templates, setTemplates] = useState<readonly BehaviorTemplateDto[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [addBotInput, setAddBotInput] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [grpRes, tmplRes] = await Promise.all([
        listBotGroups(sessionId),
        listBehaviorTemplates(),
      ]);
      setGroups(grpRes.data);
      setTemplates(tmplRes.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectedGroup = groups.find((g) => g.id === selected) ?? null;

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    await createBotGroup({ sessionId, name: newName.trim(), botNames: [] });
    setNewName('');
    await refresh();
  }, [sessionId, newName, refresh]);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteBotGroup(id);
      if (selected === id) setSelected(null);
      await refresh();
    },
    [selected, refresh],
  );

  const handleAddBots = useCallback(async () => {
    if (!selected || !addBotInput.trim()) return;
    const names = addBotInput
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    await addBotsToGroup(selected, { botNames: names });
    setAddBotInput('');
    await refresh();
  }, [selected, addBotInput, refresh]);

  const handleRemoveBot = useCallback(
    async (botName: string) => {
      if (!selected) return;
      await removeBotsFromGroup(selected, { botNames: [botName] });
      await refresh();
    },
    [selected, refresh],
  );

  const handleApplyTemplate = useCallback(
    async (templateId: string) => {
      if (!selected) return;
      await applyBehaviorToGroup(selected, { templateId });
    },
    [selected],
  );

  if (loading) return <div className="text-sm text-zinc-500">加载分组数据...</div>;

  return (
    <div className="flex gap-4 min-h-[300px]">
      {/* Left panel — group list */}
      <div className="w-64 border rounded-lg p-3 bg-white dark:bg-zinc-900 space-y-2">
        <h3 className="font-semibold text-sm">Bot 分组</h3>

        <div className="flex gap-1">
          <input
            type="text"
            placeholder="分组名"
            className="flex-1 rounded border px-2 py-1 text-sm dark:bg-zinc-800 dark:border-zinc-700"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            type="button"
            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
            onClick={handleCreate}
          >
            +
          </button>
        </div>

        <ul className="space-y-1">
          {groups.map((g) => (
            <li
              key={g.id}
              className={`flex justify-between items-center rounded px-2 py-1 text-sm cursor-pointer ${
                selected === g.id
                  ? 'bg-blue-100 dark:bg-blue-900/40'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              onClick={() => setSelected(g.id)}
            >
              <span>
                {g.name} <span className="text-zinc-400">({g.botNames.length})</span>
              </span>
              <button
                type="button"
                className="text-red-500 hover:text-red-700 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(g.id);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Right panel — group detail */}
      <div className="flex-1 border rounded-lg p-3 bg-white dark:bg-zinc-900">
        {selectedGroup ? (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">{selectedGroup.name} — Bots</h3>

            {/* Add bots */}
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="输入 bot 名 (逗号分隔)"
                className="flex-1 rounded border px-2 py-1 text-sm dark:bg-zinc-800 dark:border-zinc-700"
                value={addBotInput}
                onChange={(e) => setAddBotInput(e.target.value)}
              />
              <button
                type="button"
                className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                onClick={handleAddBots}
              >
                添加
              </button>
            </div>

            {/* Bot list */}
            <ul className="space-y-1 max-h-40 overflow-y-auto">
              {selectedGroup.botNames.map((name) => (
                <li key={name} className="flex justify-between items-center text-sm px-1">
                  <span>{name}</span>
                  <button
                    type="button"
                    className="text-red-500 hover:text-red-700 text-xs"
                    onClick={() => handleRemoveBot(name)}
                  >
                    移除
                  </button>
                </li>
              ))}
            </ul>

            {/* Apply behavior template */}
            {templates.length > 0 && (
              <div className="border-t pt-2 mt-2">
                <h4 className="text-xs text-zinc-500 mb-1">应用行为模板</h4>
                <div className="flex flex-wrap gap-1">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="rounded bg-purple-600 px-2 py-0.5 text-xs text-white hover:bg-purple-700"
                      onClick={() => handleApplyTemplate(t.id)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-zinc-400 flex items-center justify-center h-full">
            选择左侧分组查看详情
          </div>
        )}
      </div>
    </div>
  );
};

export default BotGroupPanel;
