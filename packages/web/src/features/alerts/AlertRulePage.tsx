import { type FC, useEffect, useState } from 'react';
import { useAlertsStore } from './alerts.store.js';
import AlertRuleForm from './AlertRuleForm.js';

const AlertRulePage: FC = () => {
  const { rules, fetchRules, deleteRule } = useAlertsStore();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">告警规则</h1>
        <button
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700"
          onClick={() => setShowForm(true)}
        >
          创建规则
        </button>
      </div>

      {showForm && (
        <AlertRuleForm onClose={() => setShowForm(false)} />
      )}

      <div className="overflow-hidden rounded-2xl border border-white/55 dark:border-primary-300/20 backdrop-blur-xl bg-white/80 dark:bg-slate-900/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/40 dark:bg-slate-800/40 border-b border-white/40 dark:border-primary-300/10 text-xs text-gray-600 dark:text-gray-300 font-semibold">
              <th className="text-left px-3 py-2 text-xs text-gray-600 dark:text-gray-300 font-semibold">名称</th>
              <th className="text-left px-3 py-2 text-xs text-gray-600 dark:text-gray-300 font-semibold">指标</th>
              <th className="text-left px-3 py-2 text-xs text-gray-600 dark:text-gray-300 font-semibold">条件</th>
              <th className="text-left px-3 py-2 text-xs text-gray-600 dark:text-gray-300 font-semibold">阈值</th>
              <th className="text-left px-3 py-2 text-xs text-gray-600 dark:text-gray-300 font-semibold">级别</th>
              <th className="text-left px-3 py-2 text-xs text-gray-600 dark:text-gray-300 font-semibold">状态</th>
              <th className="text-left px-3 py-2 text-xs text-gray-600 dark:text-gray-300 font-semibold">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/30 dark:divide-primary-300/10">
            {rules.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400 dark:text-gray-500">暂无规则</td></tr>
            ) : (
              rules.map((rule, idx) => (
                <tr
                  key={rule.id}
                  className={`transition-colors ${idx % 2 === 0 ? 'hover:bg-white/50 dark:hover:bg-slate-800/50' : 'bg-white/20 dark:bg-slate-800/10 hover:bg-white/60 dark:hover:bg-slate-800/60'}`}
                >
                  <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">{rule.name}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{rule.metric}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{rule.operator}</td>
                  <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">{rule.threshold}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      rule.level === 'CRITICAL' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      : rule.level === 'WARNING' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    }`}>
                      {rule.level}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs ${rule.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                      {rule.enabled ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      className="text-xs text-red-600 dark:text-red-400 hover:underline transition-colors"
                      onClick={() => deleteRule(rule.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AlertRulePage;
