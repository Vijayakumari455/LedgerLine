import { Role, UserStatus, AccountStatus } from '@prisma/client';

export { Role, UserStatus, AccountStatus };

export const ROLES = {
  ADMIN: Role.ADMIN,
  OPERATOR: Role.OPERATOR,
  CUSTOMER: Role.CUSTOMER,
} as const;

export const USER_STATUS = {
  PENDING_APPROVAL: UserStatus.PENDING_APPROVAL,
  ACTIVE: UserStatus.ACTIVE,
  SUSPENDED: UserStatus.SUSPENDED,
} as const;

export const ACCOUNT_STATUS = {
  ACTIVE: AccountStatus.ACTIVE,
  FROZEN: AccountStatus.FROZEN,
  CLOSED: AccountStatus.CLOSED,
} as const;

