import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileManagerController } from '../file-manager.controller.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FileTaskKind, TaskState } from '@jian-agent/shared-domain';

function createMockFileTaskService() {
  return {
    createTask: vi.fn().mockResolvedValue({
      taskId: 'task-1',
      state: TaskState.PENDING,
      progress: 0,
      error: null,
      serverId: 'srv-1',
      kind: 'UPLOAD',
      sourcePaths: ['/tmp/file.txt'],
      resultArtifact: null,
      errorDetail: null,
    }),
    getTask: vi.fn().mockResolvedValue(undefined),
    listTasks: vi.fn().mockResolvedValue([]),
    markRunning: vi.fn().mockResolvedValue(undefined),
    updateProgress: vi.fn().mockResolvedValue(undefined),
    markCompleted: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    markCancelled: vi.fn().mockResolvedValue(undefined),
    cancelTask: vi.fn().mockResolvedValue(undefined),
    getArtifactBuffer: vi.fn().mockResolvedValue(null),
  };
}

function createMockFileTaskExecutor() {
  return {
    submit: vi.fn().mockResolvedValue({
      taskId: 'task-1',
      state: TaskState.PENDING,
      progress: 0,
      error: null,
      serverId: 'srv-1',
      kind: 'UPLOAD',
      sourcePaths: ['/tmp/file.txt'],
      resultArtifact: null,
      errorDetail: null,
    }),
    cancel: vi.fn().mockResolvedValue({
      taskId: 'task-1',
      state: TaskState.CANCELLED,
    }),
    registerStrategy: vi.fn(),
  };
}

function createMockFileManagerService() {
  return {
    listDir: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue({ content: 'hello' }),
    writeFile: vi.fn().mockResolvedValue(undefined),
    deleteEntry: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    uploadFile: vi.fn().mockResolvedValue(undefined),
    downloadFile: vi.fn().mockResolvedValue(Buffer.from('data')),
  };
}

function createMockFileVersionService() {
  return {
    createVersion: vi.fn().mockReturnValue('ver-1'),
    listVersions: vi.fn().mockResolvedValue([]),
    getVersion: vi.fn().mockReturnValue(null),
  };
}

describe('FileManagerController — file task endpoints', () => {
  let controller: FileManagerController;
  let fileTaskService: ReturnType<typeof createMockFileTaskService>;
  let fileTaskExecutor: ReturnType<typeof createMockFileTaskExecutor>;
  let fileManager: ReturnType<typeof createMockFileManagerService>;
  let fileVersion: ReturnType<typeof createMockFileVersionService>;

  beforeEach(() => {
    fileTaskService = createMockFileTaskService();
    fileTaskExecutor = createMockFileTaskExecutor();
    fileManager = createMockFileManagerService();
    fileVersion = createMockFileVersionService();
    controller = new FileManagerController(
      fileManager as any,
      fileVersion as any,
      fileTaskService as any,
      fileTaskExecutor as any,
    );
  });

  describe('createTask', () => {
    it('should submit an UPLOAD task and return taskId', async () => {
      const result = await controller.createTask('srv-1', {
        kind: FileTaskKind.UPLOAD,
        dirPath: '/uploads',
        filename: 'file.txt',
        data: Buffer.from('hello').toString('base64'),
      } as any);

      expect(fileTaskExecutor.submit).toHaveBeenCalledOnce();
      const submitArg = fileTaskExecutor.submit.mock.calls[0][0];
      expect(submitArg.serverId).toBe('srv-1');
      expect(submitArg.kind).toBe(FileTaskKind.UPLOAD);
      expect(submitArg.sourcePaths).toEqual(['file.txt']);
      expect(submitArg.targetPath).toBe('/uploads');
      expect(result).toEqual({ taskId: 'task-1' });
    });

    it('should submit a PACK_DOWNLOAD task and return taskId', async () => {
      const result = await controller.createTask('srv-1', {
        kind: FileTaskKind.PACK_DOWNLOAD,
        paths: ['/a.txt', '/b.txt'],
      } as any);

      expect(fileTaskExecutor.submit).toHaveBeenCalledOnce();
      const submitArg = fileTaskExecutor.submit.mock.calls[0][0];
      expect(submitArg.kind).toBe(FileTaskKind.PACK_DOWNLOAD);
      expect(submitArg.sourcePaths).toEqual(['/a.txt', '/b.txt']);
      expect(result).toEqual({ taskId: 'task-1' });
    });

    it('should submit a DIR_COPY task and return taskId', async () => {
      const result = await controller.createTask('srv-1', {
        kind: FileTaskKind.DIR_COPY,
        sourcePath: '/src/dir',
        destPath: '/dst/dir',
      } as any);

      const submitArg = fileTaskExecutor.submit.mock.calls[0][0];
      expect(submitArg.kind).toBe(FileTaskKind.DIR_COPY);
      expect(submitArg.sourcePaths).toEqual(['/src/dir']);
      expect(submitArg.targetPath).toBe('/dst/dir');
      expect(result).toEqual({ taskId: 'task-1' });
    });

    it('should submit a DIR_MOVE task and return taskId', async () => {
      const result = await controller.createTask('srv-1', {
        kind: FileTaskKind.DIR_MOVE,
        sourcePath: '/src/dir',
        destPath: '/dst/dir',
      } as any);

      const submitArg = fileTaskExecutor.submit.mock.calls[0][0];
      expect(submitArg.kind).toBe(FileTaskKind.DIR_MOVE);
      expect(submitArg.sourcePaths).toEqual(['/src/dir']);
      expect(submitArg.targetPath).toBe('/dst/dir');
      expect(result).toEqual({ taskId: 'task-1' });
    });

    it('should submit a COMPRESS task and return taskId', async () => {
      const result = await controller.createTask('srv-1', {
        kind: FileTaskKind.COMPRESS,
        sourcePaths: ['/a.txt', '/b.txt'],
        archivePath: '/out/archive.tar.gz',
      } as any);

      const submitArg = fileTaskExecutor.submit.mock.calls[0][0];
      expect(submitArg.kind).toBe(FileTaskKind.COMPRESS);
      expect(submitArg.sourcePaths).toEqual(['/a.txt', '/b.txt']);
      expect(submitArg.targetPath).toBe('/out/archive.tar.gz');
      expect(result).toEqual({ taskId: 'task-1' });
    });

    it('should submit a DECOMPRESS task and return taskId', async () => {
      const result = await controller.createTask('srv-1', {
        kind: FileTaskKind.DECOMPRESS,
        archivePath: '/archive.tar.gz',
        destDir: '/output',
      } as any);

      const submitArg = fileTaskExecutor.submit.mock.calls[0][0];
      expect(submitArg.kind).toBe(FileTaskKind.DECOMPRESS);
      expect(submitArg.sourcePaths).toEqual(['/archive.tar.gz']);
      expect(submitArg.targetPath).toBe('/output');
      expect(result).toEqual({ taskId: 'task-1' });
    });

    it('should throw BadRequestException for unknown task kind', async () => {
      await expect(
        controller.createTask('srv-1', { kind: 'UNKNOWN_KIND' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listTasks', () => {
    it('should return tasks for a given server', async () => {
      fileTaskService.listTasks.mockResolvedValue([
        { taskId: 't1', state: TaskState.PENDING },
        { taskId: 't2', state: TaskState.COMPLETED },
      ]);

      const result = await controller.listTasks('srv-1');
      expect(fileTaskService.listTasks).toHaveBeenCalledWith('srv-1');
      expect(result).toHaveLength(2);
    });
  });

  describe('getTask', () => {
    it('should return a single task by taskId', async () => {
      fileTaskService.getTask.mockResolvedValue({ taskId: 't1', state: TaskState.RUNNING });

      const result = await controller.getTask('t1');
      expect(fileTaskService.getTask).toHaveBeenCalledWith('t1');
      expect(result).toEqual({ taskId: 't1', state: TaskState.RUNNING });
    });

    it('should return undefined when task not found', async () => {
      fileTaskService.getTask.mockResolvedValue(undefined);
      const result = await controller.getTask('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('cancelTask', () => {
    it('should call executor cancel and return success', async () => {
      const result = await controller.cancelTask('task-1');
      expect(fileTaskExecutor.cancel).toHaveBeenCalledWith('task-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('downloadArtifact', () => {
    it('should return artifact data when available', async () => {
      fileTaskService.getArtifactBuffer.mockResolvedValue({
        filename: 'output.zip',
        data: Buffer.from('binary-data'),
      });

      const result = await controller.downloadArtifact('task-1');
      expect(fileTaskService.getArtifactBuffer).toHaveBeenCalledWith('task-1');
      expect(result.filename).toBe('output.zip');
      expect(typeof result.data).toBe('string'); // base64 encoded
      expect(result.size).toBe(Buffer.from('binary-data').length);
    });

    it('should throw NotFoundException when artifact not available', async () => {
      fileTaskService.getArtifactBuffer.mockResolvedValue(null);
      await expect(controller.downloadArtifact('task-1')).rejects.toThrow(NotFoundException);
    });
  });
});
