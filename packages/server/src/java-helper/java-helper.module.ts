import { Module, forwardRef } from '@nestjs/common';
import { JavaHelperController } from './java-helper.controller.js';
import { JavaHelperService } from './java-helper.service.js';
import { JavaHelperAutoService } from './java-helper-auto.service.js';
import { JfrTaskService } from './jfr-task.service.js';
import { JvmCapabilityFacade } from './jvm-capability.facade.js';
import { ServerProcessModule } from '../server-process/server-process.module.js';
import { MetricsModule } from '../metrics/metrics.module.js';

@Module({
  imports: [
    forwardRef(() => ServerProcessModule),
    forwardRef(() => MetricsModule),
  ],
  controllers: [JavaHelperController],
  providers: [JavaHelperService, JavaHelperAutoService, JfrTaskService, JvmCapabilityFacade],
  exports: [JavaHelperService, JavaHelperAutoService, JfrTaskService, JvmCapabilityFacade],
})
export class JavaHelperModule {}
