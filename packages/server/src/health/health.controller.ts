import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { DrizzleDb } from '../storage/drizzle.provider.js';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import { sql } from 'drizzle-orm';

@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  @Get()
  liveness() {
    return { status: 'ok', uptime: process.uptime(), timestamp: Date.now() };
  }

  @Get('ready')
  readiness() {
    try {
      this.db.run(sql`SELECT 1`);
      return { status: 'ok', database: 'connected', timestamp: Date.now() };
    } catch (_err) {
      throw new ServiceUnavailableException({ status: 'error', database: 'disconnected' });
    }
  }
}
