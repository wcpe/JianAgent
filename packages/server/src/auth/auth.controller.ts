import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { JwtGuard } from './jwt.guard.js';
import type { LoginRequest, RegisterRequest } from '@jian-agent/shared-domain';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginRequest) {
    return this.authService.login(body);
  }

  @Post('register')
  async register(@Body() body: RegisterRequest) {
    return this.authService.register(body);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  async me(@Req() req: any) {
    return this.authService.findById(req.user.sub);
  }
}
