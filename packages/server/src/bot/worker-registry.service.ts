import { Injectable, Logger } from '@nestjs/common';
import type { WorkerInfoDto, RegisterWorkerDto, WorkerStatus } from '@jian-agent/shared-domain';

@Injectable()
export class WorkerRegistryService {
  private readonly logger = new Logger(WorkerRegistryService.name);
  private readonly workers = new Map<string, WorkerInfoDto>();

  register(input: RegisterWorkerDto): WorkerInfoDto {
    const worker: WorkerInfoDto = {
      ...input,
      status: 'online',
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
    };
    this.workers.set(input.workerId, worker);
    this.logger.log(
      `Worker registered: ${input.workerId} (${input.hostname}:${input.port}, capacity: ${input.maxCapacity})`,
    );
    return worker;
  }

  deregister(workerId: string): boolean {
    const existed = this.workers.delete(workerId);
    if (existed) this.logger.log(`Worker deregistered: ${workerId}`);
    return existed;
  }

  heartbeat(workerId: string, currentLoad: number): boolean {
    const worker = this.workers.get(workerId);
    if (!worker) return false;

    this.workers.set(workerId, {
      ...worker,
      currentLoad,
      lastHeartbeat: Date.now(),
      status: 'online',
    });
    return true;
  }

  listWorkers(filter?: { readonly status?: string; readonly tag?: string }): readonly WorkerInfoDto[] {
    let result = [...this.workers.values()];
    if (filter?.status) result = result.filter((w) => w.status === filter.status);
    if (filter?.tag) result = result.filter((w) => w.tags.includes(filter.tag!));
    return result;
  }

  getAvailableWorkers(): readonly WorkerInfoDto[] {
    return [...this.workers.values()]
      .filter((w) => w.status === 'online' && w.currentLoad < w.maxCapacity)
      .sort((a, b) => (b.maxCapacity - b.currentLoad) - (a.maxCapacity - a.currentLoad));
  }

  getWorker(workerId: string): WorkerInfoDto | undefined {
    return this.workers.get(workerId);
  }

  markUnhealthy(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      this.workers.set(workerId, { ...worker, status: 'unhealthy' });
    }
  }

  markOffline(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      this.workers.set(workerId, { ...worker, status: 'offline' });
    }
  }

  get size(): number {
    return this.workers.size;
  }
}
