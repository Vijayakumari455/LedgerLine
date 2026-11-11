export type Role = 'ADMIN' | 'OPERATOR' | 'CUSTOMER';
export type UserStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED';
export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';
export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_P2P' | 'FEE' | 'INTEREST';
export type EntryType = 'DEBIT' | 'CREDIT';
export type TransactionStatus = 'POSTED' | 'PENDING' | 'REJECTED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  createdAt?: string;
  updatedAt?: string;
  accounts?: Account[];
}

export interface Account {
  id: string;
  accountNumber: string;
  balance: string; // Paise as string (BigInt serialized)
  currency: string;
  status: AccountStatus;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  referenceId: string;
  type: TransactionType;
  status: TransactionStatus;
  entryType: EntryType;
  amount: string; // Paise as string
  balanceAfter: string; // Paise as string
  description?: string | null;
  timestamp: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StatementResponse {
  account: {
    id: string;
    accountNumber: string;
    balance: string;
    currency: string;
    status: AccountStatus;
  };
  statement: LedgerEntry[];
  pagination: Pagination;
}

export interface TransferResult {
  message: string;
  transaction: {
    id: string;
    referenceId: string;
    type: TransactionType;
    status: TransactionStatus;
    sourceAccountId: string;
    destinationAccountId: string;
    amount: string;
    idempotencyKey?: string | null;
    createdAt: string;
  };
  entries: {
    id: string;
    accountId: string;
    entryType: EntryType;
    amount: string;
    balanceAfter: string;
  }[];
}

export interface AuditLog {
  id: string;
  sequenceNumber: number;
  timestamp: string;
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  status: string;
  previousHash: string;
  currentHash: string;
  hash?: string;
  details?: Record<string, unknown> | null;
}

export interface AuditVerifyResult {
  status: 'VERIFIED' | 'TAMPERED';
  isValid: boolean;
  totalEntries: number;
  message: string;
  brokenAtSequence?: number;
  reason?: string;
}

