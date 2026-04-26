import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkerRegistryService } from './worker-registry.service.js';
import { JwtGuard } from '../auth/jwt.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RoleLevel } from '@jian-agent/shared-domain';
import type { WorkerInfoDto, RegisterWorkerDto, HeartbeatDto } from '@jian-agent/shared-domain';

@Controller('workers')
@UseGuards(JwtGuard, RolesGuard)
export class WorkerController {
  constructor(private readonly registry: WorkerRegistryService) {}

  @Post('register')
  @Roles(RoleLevel.OPERATOR)
  register(@Body() body: RegisterWorkerDto): WorkerInfoDto {
    return this.registry.register(body);
  }

  @Delete(':id')
  @Roles(RoleLevel.OPERATOR)
  deregister(@Param('id') id: string): { readonly success: boolean } {
    return { success: this.registry.deregister(id) };
  }

  @Post(':id/heartbeat')
  @Roles(RoleLevel.VIEWER)
  heartbeat(
    @Param('id') id: string,
    @Body() body: HeartbeatDto,
  ): { readonly success: boolean } {
    return { success: this.registry.heartbeat(id, body.currentLoad) };
  }

  @Get()
  @Roles(RoleLevel.VIEWER)
  list(
    @Query('status') status?: string,
    @Query('tag') tag?: string,
  ): readonly WorkerInfoDto[] {
    return this.registry.listWorkers({ status, tag });
  }

  @Get(':id')
  @Roles(RoleLevel.VIEWER)
  getWorker(@Param('id') id: string): WorkerInfoDto | undefined {
    return this.registry.getWorker(id);
  }
}
