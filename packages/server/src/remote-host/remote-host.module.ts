import { Module, forwardRef } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { SshModule } from '../ssh/ssh.module.js';
import { RemoteHostService } from './remote-host.service.js';
import { RemoteHostController } from './remote-host.controller.js';
import { PlatformResourceModule } from '../platform-resource/platform-resource.module.js';

@Module({
  imports: [StorageModule, SshModule, forwardRef(() => PlatformResourceModule)],
  providers: [RemoteHostService],
  controllers: [RemoteHostController],
  exports: [RemoteHostService],
})
export class RemoteHostModule {}
