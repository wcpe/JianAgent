import { describe, it, expect } from 'vitest';
import { TaskMapper } from '../task.mapper.js';
import { TaskState } from '@jian-agent/shared-domain';

describe('TaskMapper', () => {
  const mapper = new TaskMapper();

  describe('fromFileOperation', () => {
    it('should map a successful file upload', () => {
      const status = mapper.fromFileOperation({
        taskId: 'file-1',
        operation: 'upload',
        success: true,
      });

      expect(status.taskId).toBe('file-1');
      expect(status.state).toBe(TaskState.COMPLETED);
      expect(status.progress).toBe(1);
      expect(status.error).toBeNull();
    });

    it('should map a failed file delete', () => {
      const status = mapper.fromFileOperation({
        taskId: 'file-2',
        operation: 'delete',
        success: false,
        error: 'Permission denied',
      });

      expect(status.taskId).toBe('file-2');
      expect(status.state).toBe(TaskState.FAILED);
      expect(status.progress).toBe(0);
      expect(status.error).toBe('Permission denied');
    });

    it('should preserve custom progress', () => {
      const status = mapper.fromFileOperation({
        taskId: 'file-3',
        operation: 'download',
        success: true,
        progress: 0.5,
      });

      expect(status.progress).toBe(0.5);
    });
  });

  describe('fromPluginOperation', () => {
    it('should map a successful plugin install', () => {
      const status = mapper.fromPluginOperation({
        taskId: 'plug-1',
        operation: 'install',
        success: true,
      });

      expect(status.taskId).toBe('plug-1');
      expect(status.state).toBe(TaskState.COMPLETED);
      expect(status.progress).toBe(1);
    });

    it('should map a failed plugin reload', () => {
      const status = mapper.fromPluginOperation({
        taskId: 'plug-2',
        operation: 'reload',
        success: false,
        error: 'Plugin not found',
      });

      expect(status.state).toBe(TaskState.FAILED);
      expect(status.error).toBe('Plugin not found');
    });
  });

  describe('fromTerminalOperation', () => {
    it('should map a successful terminal execute', () => {
      const status = mapper.fromTerminalOperation({
        taskId: 'term-1',
        operation: 'execute',
        success: true,
      });

      expect(status.taskId).toBe('term-1');
      expect(status.state).toBe(TaskState.COMPLETED);
    });

    it('should map a failed terminal attach', () => {
      const status = mapper.fromTerminalOperation({
        taskId: 'term-2',
        operation: 'attach',
        success: false,
        error: 'Session not found',
      });

      expect(status.state).toBe(TaskState.FAILED);
      expect(status.error).toBe('Session not found');
    });
  });

  describe('fromParts', () => {
    it('should create a task status from raw parts', () => {
      const status = mapper.fromParts('raw-1', TaskState.RUNNING, 0.42);

      expect(status.taskId).toBe('raw-1');
      expect(status.state).toBe(TaskState.RUNNING);
      expect(status.progress).toBe(0.42);
      expect(status.error).toBeNull();
    });

    it('should default progress to 1', () => {
      const status = mapper.fromParts('raw-2', TaskState.COMPLETED);

      expect(status.progress).toBe(1);
    });

    it('should include error when provided', () => {
      const status = mapper.fromParts(
        'raw-3',
        TaskState.FAILED,
        0,
        'Something went wrong',
      );

      expect(status.state).toBe(TaskState.FAILED);
      expect(status.error).toBe('Something went wrong');
    });
  });
});
