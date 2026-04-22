import { Module, forwardRef } from '@nestjs/common';
import { ServerProcessModule } from '../server-process/server-process.module.js';
import { RemoteHostModule } from '../remote-host/remote-host.module.js';
import { PlatformModelModule } from '../platform-model/platform-model.module.js';
import { LocalValidationModule } from '../local-validation/local-validation.module.js';
import { PlatformRuntimeModule } from '../platform-runtime/platform-runtime.module.js';
import { PlatformResourceService } from './platform-resource.service.js';
import { PlatformResourceController } from './platform-resource.controller.js';
import { ResourceDetailMapper } from './resource-detail.mapper.js';
import { ResourceCapabilityResolver } from './resource-capability.resolver.js';

@Module({
  imports: [
    forwardRef(() => ServerProcessModule),
    forwardRef(() => RemoteHostModule),
    PlatformModelModule,
    forwardRef(() => LocalValidationModule),
    PlatformRuntimeModule,
  ],
  controllers: [PlatformResourceController],
  providers: [
    PlatformResourceService,
    ResourceDetailMapper,
    ResourceCapabilityResolver,
  ],
  exports: [
    PlatformResourceService,
    ResourceDetailMapper,
    ResourceCapabilityResolver,
  ],
})
export class PlatformResourceModule {}
