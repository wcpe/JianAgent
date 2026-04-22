import type { RoleLevel } from '../enums/role-level.js';

export interface LoginRequest {
  readonly username: string;
  readonly password: string;
}

export interface LoginResponse {
  readonly token: string;
  readonly user: UserInfo;
}

export interface RegisterRequest {
  readonly username: string;
  readonly password: string;
  readonly role?: RoleLevel;
}

export interface UserInfo {
  readonly id: string;
  readonly username: string;
  readonly role: RoleLevel;
  readonly createdAt: string;
}
