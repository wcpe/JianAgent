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

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'jian-agent-dev-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';
const SALT_ROUNDS = 10;
const DEFAULT_BOOTSTRAP_ADMIN_USERNAME = 'admin';
const DEFAULT_BOOTSTRAP_ADMIN_PASSWORD = 'admin123456';

type EnvMap = Record<string, string | undefined>;

export interface JwtPayload {
  sub: string;
  username: string;
  role: RoleLevel;
}

export interface BootstrapAdminConfig {
  readonly enabled: boolean;
  readonly username: string;
  readonly password: string;
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
  const password = env['JIAN_AGENT_BOOTSTRAP_ADMIN_PASSWORD']?.trim() || DEFAULT_BOOTSTRAP_ADMIN_PASSWORD;

  return { enabled, username, password };
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  async onModuleInit(): Promise<void> {
    await this.ensureBootstrapAdmin();
  }

  async ensureBootstrapAdmin(env: EnvMap = process.env): Promise<void> {
    const config = readBootstrapAdminConfig(env);
    if (!config.enabled) {
      return;
    }

    const hasUsers = this.db.select({ id: users.id }).from(users).limit(1).all().length > 0;
    if (hasUsers) {
      return;
    }

    await this.register({
      username: config.username,
      password: config.password,
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
    const rows = this.db.select().from(users).where(eq(users.username, input.username)).all();
    if (rows.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = rows[0]!;
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = { sub: user.id, username: user.username, role: user.role as RoleLevel };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const userInfo: UserInfo = { id: user.id, username: user.username, role: user.role as RoleLevel, createdAt: user.createdAt };

    return { token, user: userInfo };
  }

  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
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
