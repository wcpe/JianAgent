import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ArthasService } from './arthas.service.js';
import type { AttachServerDto, AttachResult, ArthasStatus } from './dto/attach-server.dto.js';
import type { ExecuteCommandDto, CommandResult } from './dto/execute-command.dto.js';

@Controller('arthas')
export class ArthasController {
  private readonly logger = new Logger(ArthasController.name);

  constructor(private readonly arthasService: ArthasService) {}

  /**
   * Attach Arthas to a Java process
   * POST /api/arthas/attach/:serverId
   */
  @Post('attach/:serverId')
  async attach(
    @Param('serverId') serverId: string,
    @Body() dto: AttachServerDto,
  ): Promise<AttachResult> {
    this.logger.log(`Attach request for server ${serverId}, PID ${dto.pid}`);

    if (!dto.pid || dto.pid <= 0) {
      throw new HttpException('Invalid PID', HttpStatus.BAD_REQUEST);
    }

    const result = await this.arthasService.attach(serverId, dto);

    if (!result.success) {
      throw new HttpException(
        result.error || 'Failed to attach Arthas',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return result;
  }

  /**
   * Detach Arthas from a server
   * POST /api/arthas/detach/:serverId
   */
  @Post('detach/:serverId')
  async detach(@Param('serverId') serverId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Detach request for server ${serverId}`);

    try {
      await this.arthasService.detach(serverId);
      return {
        success: true,
        message: `Arthas detached from ${serverId}`,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to detach: ${errorMessage}`);
      throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Execute Arthas command
   * POST /api/arthas/execute
   */
  @Post('execute')
  async execute(@Body() dto: ExecuteCommandDto): Promise<CommandResult> {
    this.logger.log(`Execute command on ${dto.serverId}: ${dto.command}`);

    if (!dto.serverId || !dto.command) {
      throw new HttpException('serverId and command are required', HttpStatus.BAD_REQUEST);
    }

    const result = await this.arthasService.executeCommand(dto);

    if (!result.success && result.error?.includes('not attached')) {
      throw new HttpException(result.error, HttpStatus.PRECONDITION_FAILED);
    }

    return result;
  }

  /**
   * Get Arthas status for a server
   * GET /api/arthas/status/:serverId
   */
  @Get('status/:serverId')
  async getStatus(@Param('serverId') serverId: string): Promise<ArthasStatus> {
    this.logger.debug(`Status request for server ${serverId}`);
    return this.arthasService.getStatus(serverId);
  }
}
