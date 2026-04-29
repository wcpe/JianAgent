/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import type { ResourceActionDto } from '@jian-agent/shared-domain';

// 从 ResourceListView 中提取的 pickPrimaryActions 函数逻辑
function pickPrimaryActions(
  actions: readonly ResourceActionDto[],
  status: string,
): readonly ResourceActionDto[] {
  const priorityMap: Record<string, string[]> = {
    running: ['stop', 'restart', 'terminal'],
    stopped: ['start', 'delete', 'terminal'],
    starting: ['interrupt', 'terminal'],
    error: ['restart', 'delete', 'terminal'],
  };

  const priorities = priorityMap[status] ?? ['start', 'stop', 'restart'];
  const sorted = [...actions].sort((a, b) => {
    const aIndex = priorities.indexOf(a.key);
    const bIndex = priorities.indexOf(b.key);
    const aPriority = aIndex === -1 ? 999 : aIndex;
    const bPriority = bIndex === -1 ? 999 : bIndex;
    return aPriority - bPriority;
  });

  return sorted.slice(0, 3);
}

describe('pickPrimaryActions', () => {
  const createAction = (key: string): ResourceActionDto => ({
    key,
    label: key,
    enabled: true,
  });

  it('should prioritize stop, restart, terminal for running status', () => {
    const actions = [
      createAction('delete'),
      createAction('terminal'),
      createAction('restart'),
      createAction('stop'),
      createAction('logs'),
    ];

    const result = pickPrimaryActions(actions, 'running');

    expect(result.map((a) => a.key)).toEqual(['stop', 'restart', 'terminal']);
  });

  it('should prioritize start, delete, terminal for stopped status', () => {
    const actions = [
      createAction('restart'),
      createAction('terminal'),
      createAction('delete'),
      createAction('start'),
      createAction('logs'),
    ];

    const result = pickPrimaryActions(actions, 'stopped');

    expect(result.map((a) => a.key)).toEqual(['start', 'delete', 'terminal']);
  });

  it('should prioritize interrupt, terminal for starting status', () => {
    const actions = [
      createAction('stop'),
      createAction('terminal'),
      createAction('interrupt'),
      createAction('logs'),
    ];

    const result = pickPrimaryActions(actions, 'starting');

    expect(result.map((a) => a.key)).toEqual(['interrupt', 'terminal', 'stop']);
  });

  it('should prioritize restart, delete, terminal for error status', () => {
    const actions = [
      createAction('start'),
      createAction('terminal'),
      createAction('delete'),
      createAction('restart'),
      createAction('logs'),
    ];

    const result = pickPrimaryActions(actions, 'error');

    expect(result.map((a) => a.key)).toEqual(['restart', 'delete', 'terminal']);
  });

  it('should return at most 3 actions', () => {
    const actions = [
      createAction('stop'),
      createAction('restart'),
      createAction('terminal'),
      createAction('delete'),
      createAction('logs'),
      createAction('config'),
    ];

    const result = pickPrimaryActions(actions, 'running');

    expect(result).toHaveLength(3);
  });

  it('should handle fewer than 3 actions', () => {
    const actions = [createAction('stop'), createAction('restart')];

    const result = pickPrimaryActions(actions, 'running');

    expect(result).toHaveLength(2);
    expect(result.map((a) => a.key)).toEqual(['stop', 'restart']);
  });

  it('should use default priority for unknown status', () => {
    const actions = [
      createAction('delete'),
      createAction('restart'),
      createAction('stop'),
      createAction('start'),
    ];

    const result = pickPrimaryActions(actions, 'unknown');

    expect(result.map((a) => a.key)).toEqual(['start', 'stop', 'restart']);
  });

  it('should place unprioritized actions at the end', () => {
    const actions = [
      createAction('logs'),
      createAction('config'),
      createAction('stop'),
    ];

    const result = pickPrimaryActions(actions, 'running');

    expect(result.map((a) => a.key)).toEqual(['stop', 'logs', 'config']);
  });
});
