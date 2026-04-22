import { Module } from '@nestjs/common';
import { ResourceMapper } from './resource.mapper.js';
import { TaskMapper } from './task.mapper.js';

@Module({
  providers: [ResourceMapper, TaskMapper],
  exports: [ResourceMapper, TaskMapper],
})
export class PlatformModelModule {}
