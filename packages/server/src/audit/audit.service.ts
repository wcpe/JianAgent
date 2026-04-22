import { Injectable } from '@nestjs/common';
import { AuditStoreService } from '../storage/audit-store.service.js';

interface AuditInput {
  readonly userId: string;
  readonly username: string;
  readonly operation: string;
  readonly target: string;
  readonly params: string;
  readonly success: boolean;
  readonly ip: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly store: AuditStoreService) {}

  async record(input: AuditInput): Promise<void> {
    await this.store.create({
      timestamp: new Date().toISOString(),
      ...input,
    });
  }
}
