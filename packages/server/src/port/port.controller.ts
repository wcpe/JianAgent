import { Controller, Get, Logger } from '@nestjs/common';
import { PortService } from './port.service.js';
import type { PortUsageDto } from './dto/port-usage.dto.js';

@Controller('api/ports')
export class PortController {
  private readonly logger = new Logger(PortController.name);

  constructor(private readonly portService: PortService) {}

  @Get()
  async getPortUsage(): Promise<PortUsageDto[]> {
    this.logger.log('Fetching port usage information');
    return this.portService.getPortUsage();
  }
}
