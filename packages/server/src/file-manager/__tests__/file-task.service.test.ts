import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileTaskService } from '../file-task.service.js';
import { TaskState } from '@jian-agent/shared-domain';

function createMockRow(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function createMockDb() {
  const rows: Record<string, unknown>[] = [];
  let lastInsertedId: string | null = null;

  // Use object-first approach to avoid TDZ with self-referencing methods
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  chain.values = vi.fn().mockImplementation((val: Record<string, unknown>) => {
    lastInsertedId = val.id as string;
    rows.push(val);
    return chain;
  });
  chain.set = vi.fn().mockImplementation((val: Record<string, unknown>) => {
    if (lastInsertedId) {
      const row = rows.find((r) => r.id === lastInsertedId);
      if (row) Object.assign(row, val);
    }
    return chain;
  });
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.run = vi.fn().mockReturnValue(undefined);
  chain.all = vi.fn().mockImplementation(() => {
    if (lastInsertedId) {
      const row = rows.find((r) => r.id === lastInsertedId);
      return row ? [row] : [];
    }
    return rows;
  });

  const db = {
    insert: vi.fn().mockReturnValue(chain),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue(chain),
    }),
    update: vi.fn().mockReturnValue(chain),
  };

  return { db, chain, rows };
}

function createMockMapper() {
  const withDefaults = (dto: Record<string, unknown>) => ({
    ...dto,
    attempt: 1,
    maxAttempts: 3,
    retryable: true,
    resumeToken: null,
    failureClass: null,
  });

  return {
    toDto: vi.fn().mockImplementation((row: any) => withDefaults({
      taskId: row.id,
      state: row.state,
      progress: row.progress,
      error: row.errorDetail ?? null,
      serverId: row.serverId,
      kind: row.kind,
      sourcePaths: JSON.parse(row.sourcePaths),
      resultArtifact: row.resultArtifact ?? null,
      errorDetail: row.errorDetail ?? null,
    })),
    toRunningDto: vi.fn().mockImplementation((row: any) => withDefaults({
      taskId: row.id,
      state: TaskState.RUNNING,
      progress: row.progress,
      error: row.errorDetail ?? null,
      serverId: row.serverId,
      kind: row.kind,
      sourcePaths: JSON.parse(row.sourcePaths),
      resultArtifact: row.resultArtifact ?? null,
      errorDetail: row.errorDetail ?? null,
    })),
    toCompletedDto: vi.fn().mockImplementation((row: any, artifact: string) => withDefaults({
      taskId: row.id,
      state: TaskState.COMPLETED,
      progress: 1,
      error: null,
      serverId: row.serverId,
      kind: row.kind,
      sourcePaths: JSON.parse(row.sourcePaths),
      resultArtifact: artifact,
      errorDetail: null,
    })),
    toFailedDto: vi.fn().mockImplementation((row: any, error: string, errorDetail?: string) => withDefaults({
      taskId: row.id,
      state: TaskState.FAILED,
      progress: row.progress,
      error,
      serverId: row.serverId,
      kind: row.kind,
      sourcePaths: JSON.parse(row.sourcePaths),
      resultArtifact: row.resultArtifact ?? null,
      errorDetail: errorDetail ?? null,
    })),
    toCancelledDto: vi.fn().mockImplementation((row: any) => withDefaults({
      taskId: row.id,
      state: TaskState.CANCELLED,
      progress: row.progress,
      error: row.errorDetail ?? null,
      serverId: row.serverId,
      kind: row.kind,
      sourcePaths: JSON.parse(row.sourcePaths),
      resultArtifact: row.resultArtifact ?? null,
      errorDetail: row.errorDetail ?? null,
    })),
  };
}

function createMockEventBus() {
  return { emit: vi.fn() };
}

function createMockAuditService() {
  return { record: vi.fn() };
}

describe('FileTaskService', () => {
  let service: FileTaskService;
  let mockDb: ReturnType<typeof createMockDb>['db'];
  let mockMapper: ReturnType<typeof createMockMapper>;
  let mockEventBus: ReturnType<typeof createMockEventBus>;
  let mockAuditService: ReturnType<typeof createMockAuditService>;
  let dbChain: ReturnType<typeof createMockDb>['chain'];
  let dbRows: Record<string, unknown>[];

  beforeEach(() => {
    const mock = createMockDb();
    mockDb = mock.db;
    dbChain = mock.chain;
    dbRows = mock.rows;
    mockMapper = createMockMapper();
    mockEventBus = createMockEventBus();
    mockAuditService = createMockAuditService();
    service = new FileTaskService(mockDb as any, mockMapper as any, mockEventBus as any, mockAuditService as any);
  });

  describe('createTask', () => {
    it('should insert a task with PENDING state and return mapped DTO', async () => {
      const result = await service.createTask({
        serverId: 'srv-1',
        kind: 'UPLOAD' as any,
        sourcePaths: ['/tmp/file.txt'],
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(dbChain.values).toHaveBeenCalledOnce();
      const insertArg = dbChain.values.mock.calls[0][0];
      expect(insertArg.serverId).toBe('srv-1');
      expect(insertArg.kind).toBe('UPLOAD');
      expect(insertArg.state).toBe(TaskState.PENDING);
      expect(insertArg.progress).toBe(0);
      expect(insertArg.sourcePaths).toBe('["/tmp/file.txt"]');
      expect(typeof insertArg.id).toBe('string');
      expect(typeof insertArg.createdAt).toBe('string');

      expect(mockMapper.toDto).toHaveBeenCalledOnce();
      expect(result.taskId).toBe(insertArg.id);
      expect(result.state).toBe(TaskState.PENDING);
    });
  });

  describe('getTask', () => {
    it('should return mapped DTO when row exists', async () => {
      // Pre-populate a row
      const row = createMockRow({ id: 'task-abc' });
      dbRows.push(row);

      const result = await service.getTask('task-abc');

      expect(mockMapper.toDto).toHaveBeenCalledOnce();
      expect(result).toBeDefined();
      expect(result!.taskId).toBe('task-abc');
    });

    it('should return undefined when row does not exist', async () => {
      const result = await service.getTask('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('listTasks', () => {
    it('should list all tasks when no serverId filter', async () => {
      dbRows.push(createMockRow({ id: 't1' }), createMockRow({ id: 't2' }));

      const result = await service.listTasks();
      expect(result).toHaveLength(2);
      expect(mockMapper.toDto).toHaveBeenCalledTimes(2);
    });

    it('should filter by serverId when provided', async () => {
      dbRows.push(createMockRow({ id: 't1', serverId: 'srv-1' }));
      dbRows.push(createMockRow({ id: 't2', serverId: 'srv-2' }));

      await service.listTasks('srv-1');
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('markRunning', () => {
    it('should update state to RUNNING and return running DTO', async () => {
      const row = createMockRow({ id: 'task-1' });
      dbRows.push(row);

      const result = await service.markRunning('task-1');

      expect(mockDb.update).toHaveBeenCalledOnce();
      expect(dbChain.set).toHaveBeenCalledOnce();
      const setArg = dbChain.set.mock.calls[0][0];
      expect(setArg.state).toBe(TaskState.RUNNING);

      expect(mockMapper.toRunningDto).toHaveBeenCalledOnce();
      expect(result.state).toBe(TaskState.RUNNING);
    });
  });

  describe('updateProgress', () => {
    it('should clamp progress to [0,1] and store as integer percentage', async () => {
      const row = createMockRow({ id: 'task-1' });
      dbRows.push(row);

      await service.updateProgress('task-1', 0.75);
      const setArg = dbChain.set.mock.calls[0][0];
      expect(setArg.progress).toBe(75);
    });

    it('should clamp progress above 1 to 100', async () => {
      const row = createMockRow({ id: 'task-1' });
      dbRows.push(row);

      await service.updateProgress('task-1', 1.5);
      const setArg = dbChain.set.mock.calls[0][0];
      expect(setArg.progress).toBe(100);
    });

    it('should clamp negative progress to 0', async () => {
      const row = createMockRow({ id: 'task-1' });
      dbRows.push(row);

      await service.updateProgress('task-1', -0.3);
      const setArg = dbChain.set.mock.calls[0][0];
      expect(setArg.progress).toBe(0);
    });
  });

  describe('markCompleted', () => {
    it('should set state COMPLETED, progress 100, and artifact', async () => {
      const row = createMockRow({ id: 'task-1' });
      dbRows.push(row);

      const result = await service.markCompleted('task-1', '/output/archive.zip');

      expect(mockDb.update).toHaveBeenCalledOnce();
      const setArg = dbChain.set.mock.calls[0][0];
      expect(setArg.state).toBe(TaskState.COMPLETED);
      expect(setArg.progress).toBe(100);
      expect(setArg.resultArtifact).toBe('/output/archive.zip');

      expect(mockMapper.toCompletedDto).toHaveBeenCalledOnce();
      expect(result.state).toBe(TaskState.COMPLETED);
      expect(result.resultArtifact).toBe('/output/archive.zip');
    });
  });

  describe('markFailed', () => {
    it('should set state FAILED with error details', async () => {
      const row = createMockRow({ id: 'task-1' });
      dbRows.push(row);

      const result = await service.markFailed('task-1', 'Connection timeout', 'stack trace...');

      const setArg = dbChain.set.mock.calls[0][0];
      expect(setArg.state).toBe(TaskState.FAILED);
      expect(setArg.errorDetail).toBe('stack trace...');

      expect(mockMapper.toFailedDto).toHaveBeenCalledOnce();
      expect(result.state).toBe(TaskState.FAILED);
    });

    it('should use error as errorDetail when errorDetail is not provided', async () => {
      const row = createMockRow({ id: 'task-1' });
      dbRows.push(row);

      await service.markFailed('task-1', 'Something broke');
      const setArg = dbChain.set.mock.calls[0][0];
      expect(setArg.errorDetail).toBe('Something broke');
    });
  });

  describe('markCancelled', () => {
    it('should set state CANCELLED', async () => {
      const row = createMockRow({ id: 'task-1' });
      dbRows.push(row);

      const result = await service.markCancelled('task-1');

      const setArg = dbChain.set.mock.calls[0][0];
      expect(setArg.state).toBe(TaskState.CANCELLED);

      expect(mockMapper.toCancelledDto).toHaveBeenCalledOnce();
      expect(result.state).toBe(TaskState.CANCELLED);
    });
  });

  describe('cancelTask', () => {
    it('should throw when task not found', async () => {
      await expect(service.cancelTask('nonexistent')).rejects.toThrow('File task not found: nonexistent');
    });

    it('should return task as-is if already COMPLETED', async () => {
      const row = createMockRow({ id: 'task-1', state: 'COMPLETED' });
      dbRows.push(row);

      const result = await service.cancelTask('task-1');
      expect(result.state).toBe(TaskState.COMPLETED);
      // markCancelled should NOT be called
      expect(mockMapper.toCancelledDto).not.toHaveBeenCalled();
    });

    it('should return task as-is if already FAILED', async () => {
      const row = createMockRow({ id: 'task-1', state: 'FAILED' });
      dbRows.push(row);

      const result = await service.cancelTask('task-1');
      expect(result.state).toBe(TaskState.FAILED);
      expect(mockMapper.toCancelledDto).not.toHaveBeenCalled();
    });

    it('should return task as-is if already CANCELLED', async () => {
      const row = createMockRow({ id: 'task-1', state: 'CANCELLED' });
      dbRows.push(row);

      const result = await service.cancelTask('task-1');
      expect(result.state).toBe(TaskState.CANCELLED);
      expect(mockMapper.toCancelledDto).not.toHaveBeenCalled();
    });

    it('should mark as cancelled when task is PENDING', async () => {
      const row = createMockRow({ id: 'task-1', state: 'PENDING' });
      dbRows.push(row);

      const result = await service.cancelTask('task-1');
      expect(mockMapper.toCancelledDto).toHaveBeenCalledOnce();
      expect(result.state).toBe(TaskState.CANCELLED);
    });
  });

  describe('getArtifactBuffer', () => {
    it('should return null when task not found', async () => {
      const result = await service.getArtifactBuffer('nonexistent');
      expect(result).toBeNull();
    });

    it('should return null when task is not COMPLETED', async () => {
      const row = createMockRow({ id: 'task-1', state: 'RUNNING' });
      dbRows.push(row);

      const result = await service.getArtifactBuffer('task-1');
      expect(result).toBeNull();
    });

    it('should return null when resultArtifact is null', async () => {
      const row = createMockRow({ id: 'task-1', state: 'COMPLETED', resultArtifact: null });
      dbRows.push(row);

      const result = await service.getArtifactBuffer('task-1');
      expect(result).toBeNull();
    });

    it('should return null when artifact file cannot be read', async () => {
      const row = createMockRow({
        id: 'task-1',
        state: 'COMPLETED',
        resultArtifact: '/nonexistent/path/file.zip',
      });
      dbRows.push(row);

      const result = await service.getArtifactBuffer('task-1');
      expect(result).toBeNull();
    });
  });
});
