import { Controller, Get, Logger, Param, ParseIntPipe, Post } from '@nestjs/common';
import { PortService } from './port.service.js';
import type { PortUsageDto } from './dto/port-usage.dto.js';

@Controller('ports')
export class PortController {
  private readonly logger = new Logger(PortController.name);

  constructor(private readonly portService: PortService) {}

  @Get()
  async getPortUsage(): Promise<PortUsageDto[]> {
    this.logger.log('Fetching port usage information');
    return this.portService.getPortUsage();
  }

  @Get(':port')
  async getPortDetail(@Param('port', ParseIntPipe) port: number) {
    this.logger.log(`Fetching detail for port ${port}`);
    const detail = await this.portService.getPortDetail(port);
    return { success: true, data: detail };
  }

  @Get('check-jvm/:port')
  async checkPortJvm(@Param('port', ParseIntPipe) port: number) {
    const detail = await this.portService.getPortDetail(port);
    return {
      success: true,
      data: {
        port,
        pid: detail?.pid,
        isJvm: Boolean(detail?.isJvm),
        jvmMainClass: detail?.jvmMainClass,
      },
    };
  }

  @Post(':port/close')
  async closePort(@Param('port', ParseIntPipe) port: number) {
    this.logger.warn(`Closing processes on port ${port}`);
    const result = await this.portService.closePort(port);
    return { success: true, data: result };
  }
}
