import { Controller, Get, Delete, Query, UseGuards } from '@nestjs/common';
import { PopulationTrackerService } from './population-tracker.service.js';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RoleLevel } from '@jian-agent/shared-domain';

@Controller('api/population')
@UseGuards(JwtGuard, RolesGuard)
export class PopulationController {
  constructor(private readonly populationTracker: PopulationTrackerService) {}

  @Get()
  @Roles(RoleLevel.VIEWER)
  getHistory(
    @Query('serverId') serverId?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('limit') limit?: string,
  ) {
    const data = this.populationTracker.getHistory({
      serverId: serverId || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      limit: limit ? parseInt(limit, 10) : 1440,
    });
    return { success: true, data };
  }

  @Delete('retention')
  @Roles(RoleLevel.ADMIN)
  cleanup(@Query('days') days?: string) {
    const retentionDays = days ? parseInt(days, 10) : 30;
    const deleted = this.populationTracker.cleanup(retentionDays);
    return { success: true, deleted };
  }
}
