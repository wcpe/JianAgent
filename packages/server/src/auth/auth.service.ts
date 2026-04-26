import { Injectable, Inject, UnauthorizedException, ConflictException, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import type { DrizzleDb } from '../storage/drizzle.provider.js';
import { DRIZZLE_TOKEN } from '../storage/drizzle.provider.js';
import { users } from '../storage/schema.js';
import type { LoginRequest, LoginResponse, RegisterRequest, UserInfo } from '@jian-agent/shared-domain';
import { RoleLevel } from '@jian-agent/shared-domain';
import { readAuthRateLimitConfig } from '../common/network-config.js';
import type { AuthRateLimitConfig } from '../common/network-config.js';

type EnvMap = Record<string, string | undefined>;

const JWT_EXPIRES_IN = '24h';
const DEV_FALLBACK_JWT_SECRET = 'jian-agent-dev-secret-do-not-use-in-production';
const SALT_ROUNDS = 10;
const DEFAULT_BOOTSTRAP_ADMIN_USERNAME = 'admin';

export interface JwtConfig {
  readonly secret: string;
}

export function readJwtConfig(env: EnvMap = process.env): JwtConfig {
  const secret = env['JWT_SECRET']?.trim();

  if (!secret) {
    if (env['NODE_ENV'] === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    return { secret: DEV_FALLBACK_JWT_SECRET };
  }

  return { secret };
}

export interface JwtPayload {
  sub: string;
  username: string;
  role: RoleLevel;
}

export interface BootstrapAdminConfig {
  readonly enabled: boolean;
  readonly username: string;
  readonly password: string;
  readonly passwordFromEnv: boolean;
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return undefined;
}

export function readBootstrapAdminConfig(env: EnvMap = process.env): BootstrapAdminConfig {
  const enabled = parseBooleanEnv(env['JIAN_AGENT_BOOTSTRAP_ADMIN']) ?? env['NODE_ENV'] !== 'production';
  const username = env['JIAN_AGENT_BOOTSTRAP_ADMIN_USERNAME']?.trim() || DEFAULT_BOOTSTRAP_ADMIN_USERNAME;
  const rawPassword = env['JIAN_AGENT_BOOTSTRAP_ADMIN_PASSWORD']?.trim();
  const passwordFromEnv = Boolean(rawPassword);
  const password = rawPassword ?? '';

  return { enabled, username, password, passwordFromEnv };
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtConfig: JwtConfig;
  private readonly rateLimitConfig: AuthRateLimitConfig;
  private readonly loginAttempts = new Map<string, { count: number; firstAttempt: number }>();

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {
    this.jwtConfig = readJwtConfig();
    this.rateLimitConfig = readAuthRateLimitConfig();
  }

  async onModuleInit(): Promise<void> {
    if (this.jwtConfig.secret === DEV_FALLBACK_JWT_SECRET) {
      this.logger.warn(
        'JWT_SECRET is not set — using an insecure development fallback. Set JWT_SECRET before deploying to production.',
      );
    }
    await this.ensureBootstrapAdmin();
  }

  async ensureBootstrapAdmin(env: EnvMap = process.env): Promise<void> {
    const config = readBootstrapAdminConfig(env);
    if (!config.enabled) {
      return;
    }

    const isProduction = env['NODE_ENV'] === 'production';

    if (isProduction && !config.passwordFromEnv) {
      throw new Error(
        'JIAN_AGENT_BOOTSTRAP_ADMIN_PASSWORD is required when bootstrap admin is enabled in production',
      );
    }

    const hasUsers = this.db.select({ id: users.id }).from(users).limit(1).all().length > 0;
    if (hasUsers) {
      return;
    }

    let password = config.password;
    if (!config.passwordFromEnv) {
      password = randomUUID();
      console.log('\n╔══════════════════════════════════════════════════════════╗');
      console.log('║  Bootstrap Admin Account Created                         ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log(`║  Username: ${config.username.padEnd(46)}║`);
      console.log(`║  Password: ${password.padEnd(46)}║`);
      console.log('║                                                          ║');
      console.log('║  ⚠ Change this password after first login!               ║');
      console.log('║  Or set JIAN_AGENT_BOOTSTRAP_ADMIN_PASSWORD env var.     ║');
      console.log('╚══════════════════════════════════════════════════════════╝\n');
    }

    await this.register({
      username: config.username,
      password,
      role: RoleLevel.ADMIN,
    });
    this.logger.log(`Bootstrapped local admin account '${config.username}' for an empty database`);
  }

  async register(input: RegisterRequest): Promise<UserInfo> {
    const existing = this.db.select().from(users).where(eq(users.username, input.username)).all();
    if (existing.length > 0) {
      throw new ConflictException(`Username already exists: ${input.username}`);
    }

    const id = randomUUID();
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const role = input.role ?? RoleLevel.VIEWER;
    const createdAt = new Date().toISOString();

    this.db.insert(users).values({ id, username: input.username, passwordHash, role, createdAt }).run();

    return { id, username: input.username, role, createdAt };
  }

  async login(input: LoginRequest): Promise<LoginResponse> {
    const attempts = this.loginAttempts.get(input.username);
    const now = Date.now();
    if (attempts) {
      if (now - attempts.firstAttempt > this.rateLimitConfig.loginWindowMs) {
        this.loginAttempts.delete(input.username);
      } else if (attempts.count >= this.rateLimitConfig.maxLoginAttempts) {
        this.logger.warn(`Login locked out for user '${input.username}' — too many failed attempts`);
        throw new UnauthorizedException('Too many failed login attempts. Please try again later.');
      }
    }

    const rows = this.db.select().from(users).where(eq(users.username, input.username)).all();
    if (rows.length === 0) {
      const current = this.loginAttempts.get(input.username) ?? { count: 0, firstAttempt: now };
      current.count++;
      this.loginAttempts.set(input.username, current);
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = rows[0]!;
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      const current = this.loginAttempts.get(input.username) ?? { count: 0, firstAttempt: now };
      current.count++;
      this.loginAttempts.set(input.username, current);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.loginAttempts.delete(input.username);

    const payload: JwtPayload = { sub: user.id, username: user.username, role: user.role as RoleLevel };
    const token = jwt.sign(payload, this.jwtConfig.secret, { expiresIn: JWT_EXPIRES_IN });
    const userInfo: UserInfo = { id: user.id, username: user.username, role: user.role as RoleLevel, createdAt: user.createdAt };

    return { token, user: userInfo };
  }

  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.jwtConfig.secret) as JwtPayload;
    } catch (_err) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async findById(id: string): Promise<UserInfo | undefined> {
    const rows = this.db.select().from(users).where(eq(users.id, id)).all();
    if (rows.length === 0) return undefined;
    const u = rows[0]!;
    return { id: u.id, username: u.username, role: u.role as RoleLevel, createdAt: u.createdAt };
  }
}
