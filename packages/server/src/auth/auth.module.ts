import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtGuard } from './jwt.guard.js';
import { RolesGuard } from './roles.guard.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtGuard, RolesGuard],
  exports: [AuthService, JwtGuard, RolesGuard],
})
export class AuthModule {}
