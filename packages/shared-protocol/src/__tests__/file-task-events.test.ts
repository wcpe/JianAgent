import { describe, it, expect } from 'vitest';
import type {
  FileTaskProgressPayload,
  FileTaskCompletedPayload,
  FileTaskFailedPayload,
} from '../file-task-events.js';
import type { FileTaskDto } from '@jian-agent/shared-domain';
import { TaskState, FileTaskKind } from '@jian-agent/shared-domain';

const mockTask: FileTaskDto = {
  taskId: 'task-1',
  state: TaskState.COMPLETED,
  progress: 1,
  error: null,
  attempt: 1,
  maxAttempts: 3,
  retryable: true,
  resumeToken: null,
  failureClass: null,
  serverId: 'srv-1',
  kind: FileTaskKind.UPLOAD,
  sourcePaths: ['/tmp/file.txt'],
  resultArtifact: '/uploads/file.txt',
  errorDetail: null,
};

describe('FileTaskProgressPayload contract', () => {
  it('should have required fields with correct types', () => {
    const payload: FileTaskProgressPayload = {
      taskId: 'task-1',
      serverId: 'srv-1',
      kind: FileTaskKind.UPLOAD,
      progress: 0.5,
      message: 'Uploading...',
      timestamp: '2026-01-01T00:00:00.000Z',
    };

    expect(typeof payload.taskId).toBe('string');
    expect(typeof payload.serverId).toBe('string');
    expect(typeof payload.kind).toBe('string');
    expect(typeof payload.progress).toBe('number');
    expect(typeof payload.message).toBe('string');
    expect(typeof payload.timestamp).toBe('string');
  });

  it('should accept all FileTaskKind values', () => {
    const kinds: FileTaskKind[] = [
      FileTaskKind.UPLOAD,
      FileTaskKind.PACK_DOWNLOAD,
      FileTaskKind.DIR_COPY,
      FileTaskKind.DIR_MOVE,
      FileTaskKind.COMPRESS,
      FileTaskKind.DECOMPRESS,
      FileTaskKind.REMOTE_DOWNLOAD,
    ];

    for (const kind of kinds) {
      const payload: FileTaskProgressPayload = {
        taskId: 'task-1',
        serverId: 'srv-1',
        kind,
        progress: 0.5,
        message: 'Working...',
        timestamp: new Date().toISOString(),
      };
      expect(payload.kind).toBe(kind);
    }
  });

  it('should have readonly fields (compile-time contract)', () => {
    const payload: FileTaskProgressPayload = {
      taskId: 'task-1',
      serverId: 'srv-1',
      kind: FileTaskKind.UPLOAD,
      progress: 0.5,
      message: 'Uploading...',
      timestamp: '2026-01-01T00:00:00.000Z',
    };

    // Verify the fields are present and correctly typed
    expect(payload).toHaveProperty('taskId');
    expect(payload).toHaveProperty('serverId');
    expect(payload).toHaveProperty('kind');
    expect(payload).toHaveProperty('progress');
    expect(payload).toHaveProperty('message');
    expect(payload).toHaveProperty('timestamp');
  });
});

describe('FileTaskCompletedPayload contract', () => {
  it('should have required fields with correct types', () => {
    const payload: FileTaskCompletedPayload = {
      taskId: 'task-1',
      serverId: 'srv-1',
      kind: FileTaskKind.UPLOAD,
      resultArtifact: '/uploads/file.txt',
      timestamp: '2026-01-01T00:00:00.000Z',
      task: mockTask,
    };

    expect(typeof payload.taskId).toBe('string');
    expect(typeof payload.serverId).toBe('string');
    expect(typeof payload.kind).toBe('string');
    expect(typeof payload.resultArtifact).toBe('string');
    expect(typeof payload.timestamp).toBe('string');
    expect(payload.task).toBeDefined();
  });

  it('should contain a valid FileTaskDto as task field', () => {
    const payload: FileTaskCompletedPayload = {
      taskId: mockTask.taskId,
      serverId: mockTask.serverId,
      kind: mockTask.kind,
      resultArtifact: mockTask.resultArtifact!,
      timestamp: '2026-01-01T00:00:00.000Z',
      task: mockTask,
    };

    // Verify FileTaskDto shape contract
    expect(payload.task).toHaveProperty('taskId');
    expect(payload.task).toHaveProperty('state');
    expect(payload.task).toHaveProperty('progress');
    expect(payload.task).toHaveProperty('error');
    expect(payload.task).toHaveProperty('serverId');
    expect(payload.task).toHaveProperty('kind');
    expect(payload.task).toHaveProperty('sourcePaths');
    expect(payload.task).toHaveProperty('resultArtifact');
    expect(payload.task).toHaveProperty('errorDetail');

    // Verify types
    expect(typeof payload.task.taskId).toBe('string');
    expect(typeof payload.task.state).toBe('string');
    expect(typeof payload.task.progress).toBe('number');
    expect(Array.isArray(payload.task.sourcePaths)).toBe(true);
  });

  it('should link task fields to payload fields', () => {
    const payload: FileTaskCompletedPayload = {
      taskId: mockTask.taskId,
      serverId: mockTask.serverId,
      kind: mockTask.kind,
      resultArtifact: mockTask.resultArtifact!,
      timestamp: '2026-01-01T00:00:00.000Z',
      task: mockTask,
    };

    // The top-level fields should match the nested task
    expect(payload.taskId).toBe(payload.task.taskId);
    expect(payload.serverId).toBe(payload.task.serverId);
    expect(payload.kind).toBe(payload.task.kind);
  });
});

describe('FileTaskFailedPayload contract', () => {
  it('should have required fields with correct types', () => {
    const payload: FileTaskFailedPayload = {
      taskId: 'task-1',
      serverId: 'srv-1',
      kind: FileTaskKind.UPLOAD,
      errorDetail: 'Connection timed out',
      timestamp: '2026-01-01T00:00:00.000Z',
      task: { ...mockTask, state: TaskState.FAILED, error: 'Connection timed out' },
    };

    expect(typeof payload.taskId).toBe('string');
    expect(typeof payload.serverId).toBe('string');
    expect(typeof payload.kind).toBe('string');
    expect(typeof payload.errorDetail).toBe('string');
    expect(typeof payload.timestamp).toBe('string');
    expect(payload.task).toBeDefined();
  });

  it('should contain a valid FileTaskDto with FAILED state', () => {
    const failedTask: FileTaskDto = {
      ...mockTask,
      state: TaskState.FAILED,
      error: 'Upload failed',
      errorDetail: 'Network error at step 3',
    };

    const payload: FileTaskFailedPayload = {
      taskId: failedTask.taskId,
      serverId: failedTask.serverId,
      kind: failedTask.kind,
      errorDetail: failedTask.errorDetail!,
      timestamp: '2026-01-01T00:00:00.000Z',
      task: failedTask,
    };

    expect(payload.task.state).toBe(TaskState.FAILED);
    expect(payload.task.error).toBe('Upload failed');
    expect(payload.task.errorDetail).toBe('Network error at step 3');
  });

  it('should link task fields to payload fields', () => {
    const failedTask: FileTaskDto = {
      ...mockTask,
      state: TaskState.FAILED,
      error: 'Failed',
      errorDetail: 'Detail',
    };

    const payload: FileTaskFailedPayload = {
      taskId: failedTask.taskId,
      serverId: failedTask.serverId,
      kind: failedTask.kind,
      errorDetail: failedTask.errorDetail!,
      timestamp: '2026-01-01T00:00:00.000Z',
      task: failedTask,
    };

    expect(payload.taskId).toBe(payload.task.taskId);
    expect(payload.serverId).toBe(payload.task.serverId);
    expect(payload.kind).toBe(payload.task.kind);
  });
});

describe('FileTaskDto contract (via payloads)', () => {
  it('should satisfy TaskStatusDto base fields', () => {
    const task: FileTaskDto = {
      taskId: 'task-abc',
      state: TaskState.RUNNING,
      progress: 42,
      error: null,
      attempt: 1,
      maxAttempts: 3,
      retryable: true,
      resumeToken: null,
      failureClass: null,
      serverId: 'srv-1',
      kind: FileTaskKind.DIR_COPY,
      sourcePaths: ['/src/a', '/src/b'],
      resultArtifact: null,
      errorDetail: null,
    };

    // TaskStatusDto fields
    expect(typeof task.taskId).toBe('string');
    expect(Object.values(TaskState)).toContain(task.state);
    expect(typeof task.progress).toBe('number');

    // FileTaskDto-specific fields
    expect(typeof task.serverId).toBe('string');
    expect(Object.values(FileTaskKind)).toContain(task.kind);
    expect(Array.isArray(task.sourcePaths)).toBe(true);
    task.sourcePaths.forEach((p) => expect(typeof p).toBe('string'));
  });

  it('should accept all TaskState values', () => {
    const states = Object.values(TaskState);
    for (const state of states) {
      const task: FileTaskDto = {
        ...mockTask,
        state,
      };
      expect(task.state).toBe(state);
    }
  });
});
