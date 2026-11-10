import { Request } from 'express';
import { Role, UserStatus } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  csrfToken?: string;
  idempotencyKey?: string;
}

