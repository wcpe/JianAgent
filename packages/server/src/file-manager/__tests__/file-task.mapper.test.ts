import { describe, expect, it } from 'vitest';
import { FileTaskMapper } from '../file-task.mapper.js';

describe('FileTaskMapper', () => {
  it('adds retry and failure metadata defaults for pending tasks', () => {
    const mapper = new FileTaskMapper();
    const dto = mapper.toDto({
      id: 'task-1',
      serverId: 'srv-1',
      kind: 'UPLOAD',
      state: 'PENDING',
      attempt: 1,
      maxAttempts: 3,
      retryable: true,
      resumeToken: null,
      failureClass: null,
      progress: 0,
      sourcePaths: '["/tmp/file.txt"]',
      resultArtifact: null,
      errorDetail: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as any);

    expect(dto.attempt).toBe(1);
    expect(dto.maxAttempts).toBe(3);
    expect(dto.retryable).toBe(true);
    expect(dto.resumeToken).toBeNull();
    expect(dto.failureClass).toBeNull();
  });

  it('classifies timeout failures as retryable network failures', () => {
    const mapper = new FileTaskMapper();
    const dto = mapper.toFailedDto({
      id: 'task-1',
      serverId: 'srv-1',
      kind: 'UPLOAD',
      state: 'FAILED',
      attempt: 2,
      maxAttempts: 3,
      retryable: true,
      resumeToken: 'task-1:attempt:2',
      failureClass: 'network-timeout',
      progress: 40,
      sourcePaths: '["/tmp/file.txt"]',
      resultArtifact: null,
      errorDetail: 'FILE_REMOTE_TIMEOUT: Remote file operation timed out',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as any, 'FILE_REMOTE_TIMEOUT: Remote file operation timed out');

    expect(dto.retryable).toBe(true);
    expect(dto.failureClass).toBe('network-timeout');
    expect(dto.resumeToken).toBe('task-1:attempt:2');
  });
});
