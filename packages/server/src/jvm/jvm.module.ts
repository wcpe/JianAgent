import { Module } from '@nestjs/common';
import { JvmController } from './jvm.controller';
import { JvmService } from './jvm.service';
import { JavaHelperModule } from '../java-helper/java-helper.module';

@Module({
  imports: [JavaHelperModule],
  controllers: [JvmController],
  providers: [JvmService],
  exports: [JvmService],
})
export class JvmModule {}
