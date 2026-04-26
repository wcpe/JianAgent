import type { JwtPayload } from './auth.service.js';

export interface AuthenticatedRequest {
  user: JwtPayload;
}
