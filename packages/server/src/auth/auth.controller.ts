import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { JwtGuard } from './jwt.guard.js';
import type { LoginRequest, RegisterRequest } from '@jian-agent/shared-domain';
import { Auditable } from '../audit/auditable.decorator.js';
import type { AuthenticatedRequest } from './authenticated-request.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Auditable('auth:login')
  async login(@Body() body: LoginRequest) {
    return this.authService.login(body);
  }

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Auditable('auth:register')
  async register(@Body() body: RegisterRequest) {
    return this.authService.register(body);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  async me(@Req() req: AuthenticatedRequest) {
    return this.authService.findById(req.user.sub);
  }
}
