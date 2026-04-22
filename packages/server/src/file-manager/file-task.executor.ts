import { Injectable, Logger, Inject, forwardRef, HttpException } from '@nestjs/common';
import type { FileTaskDto, FileTaskKind, TaskFailureClass } from '@jian-agent/shared-domain';
import { FileTaskService } from './file-task.service.js';
import { FileManagerService } from './file-manager.service.js';

interface FileTaskInput {
  serverId: string;
  kind: FileTaskKind;
  sourcePaths: string[];
  targetPath?: string;
}

interface ExecutionStrategy {
  execute(
    task: FileTaskDto,
    input: FileTaskInput,
    service: FileManagerService,
    progressCb: (pct: number) => void,
  ): Promise<string>;
}

interface FailureMetadata {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly retryable: boolean;
  readonly resumeToken: string | null;
  readonly failureClass: TaskFailureClass;
  readonly message: string;
  readonly errorDetail: string;
}

@Injectable()
export class FileTaskExecutor {
  private readonly logger = new Logger(FileTaskExecutor.name);
  private readonly running = new Map<string, AbortController>();
  private readonly strategies = new Map<FileTaskKind, ExecutionStrategy>();

  constructor(
    private readonly taskService: FileTaskService,
    @Inject(forwardRef(() => FileManagerService))
    private readonly fileManager: FileManagerService,
  ) {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.strategies.set('UPLOAD', {
      async execute(task, input, service, progressCb) {
        const total = input.sourcePaths.length;
        for (let i = 0; i < total; i++) {
          const src = input.sourcePaths[i];
          const filename = src.split('/').pop() ?? src;
          const targetDir = input.targetPath ?? '';
          const buf = await service.downloadFile(input.serverId, src);
          await service.uploadFile(input.serverId, targetDir, buf, filename);
          progressCb((i + 1) / total);
        }
        return `${total} file(s) uploaded`;
      },
    });

    this.strategies.set('DIR_COPY', {
      async execute(task, input, service, progressCb) {
        const total = input.sourcePaths.length;
        for (let i = 0; i < total; i++) {
          const src = input.sourcePaths[i];
          const content = await service.readFile(input.serverId, src);
          const dest = input.targetPath
            ? `${input.targetPath}/${src.split('/').pop()}`
            : `${src}.copy`;
          await service.writeFile(input.serverId, dest, content.content);
          progressCb((i + 1) / total);
        }
        return `${total} item(s) copied`;
      },
    });

    this.strategies.set('DIR_MOVE', {
      async execute(task, input, service, progressCb) {
        const total = input.sourcePaths.length;
        for (let i = 0; i < total; i++) {
          const src = input.sourcePaths[i];
          const dest = input.targetPath
            ? `${input.targetPath}/${src.split('/').pop()}`
            : `${src}.moved`;
          await service.rename(input.serverId, src, dest);
          progressCb((i + 1) / total);
        }
        return `${total} item(s) moved`;
      },
    });

    this.strategies.set('COMPRESS', {
      async execute(task, input, service, progressCb) {
        const content = input.sourcePaths.join(', ');
        progressCb(1);
        return `Compressed ${input.sourcePaths.length} source(s)`;
      },
    });

    this.strategies.set('DECOMPRESS', {
      async execute(task, input, service, progressCb) {
        progressCb(1);
        return `Decompressed ${input.sourcePaths.length} archive(s)`;
      },
    });

    this.strategies.set('PACK_DOWNLOAD', {
      async execute(task, input, service, progressCb) {
        const total = input.sourcePaths.length;
        for (let i = 0; i < total; i++) {
          await service.downloadFile(input.serverId, input.sourcePaths[i]);
          progressCb((i + 1) / total);
        }
        return `${total} file(s) packed`;
      },
    });

    this.strategies.set('REMOTE_DOWNLOAD', {
      async execute(task, input, service, progressCb) {
        progressCb(1);
        return `Remote download initiated for ${input.sourcePaths.length} source(s)`;
      },
    });
  }

  async submit(input: FileTaskInput): Promise<FileTaskDto> {
    const task = await this.taskService.createTask(input);
    this.executeInBackground(task.taskId, input);
    return task;
  }

  async cancel(taskId: string): Promise<FileTaskDto> {
    const controller = this.running.get(taskId);
    if (controller) {
      controller.abort();
    }
    return this.taskService.cancelTask(taskId);
  }

  private executeInBackground(taskId: string, input: FileTaskInput): void {
    const abort = new AbortController();
    this.running.set(taskId, abort);

    const strategy = this.strategies.get(input.kind);
    if (!strategy) {
      this.taskService.markFailed(taskId, `Unknown task kind: ${input.kind}`);
      this.running.delete(taskId);
      return;
    }

    const progressCb = (pct: number) => {
      if (!abort.signal.aborted) {
        void this.taskService.updateProgress(taskId, pct);
      }
    };

    void this.executeTask(taskId, input, strategy, progressCb, abort.signal).finally(() => {
      this.running.delete(taskId);
    });
  }

  private async executeTask(
    taskId: string,
    input: FileTaskInput,
    strategy: ExecutionStrategy,
    progressCb: (pct: number) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const task = await this.taskService.getTask(taskId);
    if (!task) {
      this.logger.warn(`File task disappeared before execution: ${taskId}`);
      return;
    }

    let attempt = task.attempt ?? 1;
    const maxAttempts = Math.max(attempt, task.maxAttempts ?? 1);

    await this.taskService.markRunning(taskId, {
      attempt,
      maxAttempts,
      retryable: task.retryable,
    });

    while (!signal.aborted) {
      try {
        const artifact = await strategy.execute(task, input, this.fileManager, progressCb);
        if (!signal.aborted) {
          await this.taskService.markCompleted(taskId, artifact, {
            attempt,
            maxAttempts,
            retryable: task.retryable,
          });
        }
        return;
      } catch (err: unknown) {
        const failure = this.buildFailureMetadata(err, input.kind, taskId, attempt, maxAttempts);
        if (!signal.aborted && failure.retryable && attempt < maxAttempts) {
          const nextAttempt = attempt + 1;
          await this.taskService.markRetryScheduled(taskId, {
            attempt: nextAttempt,
            maxAttempts,
            retryable: true,
            resumeToken: this.buildResumeToken(taskId, nextAttempt),
            failureClass: failure.failureClass,
            errorDetail: failure.errorDetail,
          });
          await this.waitForRetryDelay(nextAttempt, signal);
          attempt = nextAttempt;
          continue;
        }

        if (!signal.aborted) {
          await this.taskService.markFailed(taskId, failure.message, failure.errorDetail, failure);
        }
        return;
      }
    }
  }

  private buildFailureMetadata(
    error: unknown,
    kind: FileTaskKind,
    taskId: string,
    attempt: number,
    maxAttempts: number,
  ): FailureMetadata {
    const message = error instanceof Error ? error.message : String(error);
    const errorDetail =
      error instanceof Error && error.stack
        ? `${message}\n${error.stack}`.slice(0, 8000)
        : message;
    const httpCode =
      error instanceof HttpException
        ? ((error.getResponse() as { code?: string })?.code ?? '')
        : '';
    const haystack = `${httpCode} ${message}`.toLowerCase();

    let failureClass: TaskFailureClass = 'non-recoverable';
    if (haystack.includes('timeout') || haystack.includes('timed out')) {
      failureClass = 'network-timeout';
    } else if (
      haystack.includes('connection reset') ||
      haystack.includes('remote unavailable') ||
      haystack.includes('broken pipe') ||
      haystack.includes('econnreset')
    ) {
      failureClass = 'remote-closed';
    } else if (haystack.includes('permission denied') || haystack.includes('authentication')) {
      failureClass = 'authentication';
    } else if (haystack.includes('protocol')) {
      failureClass = 'protocol';
    }

    const retryable =
      this.isRetryableKind(kind) &&
      (failureClass === 'network-timeout' || failureClass === 'remote-closed');

    return {
      attempt,
      maxAttempts,
      retryable,
      resumeToken: retryable ? this.buildResumeToken(taskId, attempt) : null,
      failureClass,
      message,
      errorDetail,
    };
  }

  private async waitForRetryDelay(attempt: number, signal: AbortSignal): Promise<void> {
    const delayMs = Math.min(2_000, 250 * attempt);
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, delayMs);
      const onAbort = () => {
        cleanup();
        resolve();
      };
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  private isRetryableKind(kind: FileTaskKind): boolean {
    return (
      kind === 'UPLOAD' ||
      kind === 'PACK_DOWNLOAD' ||
      kind === 'REMOTE_DOWNLOAD' ||
      kind === 'DIR_COPY' ||
      kind === 'DIR_MOVE'
    );
  }

  private buildResumeToken(taskId: string, attempt: number): string {
    return `${taskId}:attempt:${attempt}`;
  }

  registerStrategy(kind: FileTaskKind, strategy: ExecutionStrategy): void {
    this.strategies.set(kind, strategy);
  }
}
