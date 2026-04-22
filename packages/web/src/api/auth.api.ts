import { apiFetch } from './client.js';
import type { LoginRequest, LoginResponse, UserInfo } from '@jian-agent/shared-domain';

export function login(data: LoginRequest): Promise<LoginResponse> {
  return apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(data) });
}

export function getMe(): Promise<UserInfo> {
  return apiFetch('/auth/me');
}
