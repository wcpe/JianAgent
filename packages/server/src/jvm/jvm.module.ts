import { Module } from '@nestjs/common';
import { JvmController } from './jvm.controller';
import { JvmService } from './jvm.service';
import { JavaHelperModule } from '../java-helper/java-helper.module';
import { FileManagerModule } from '../file-manager/file-manager.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [JavaHelperModule, FileManagerModule, AuditModule],
  controllers: [JvmController],
  providers: [JvmService],
  exports: [JvmService],
})
export class JvmModule {}
