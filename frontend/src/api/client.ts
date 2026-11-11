import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import {
  User,
  Account,
  StatementResponse,
  TransferResult,
  AuditLog,
  AuditVerifyResult,
  Pagination,
  Role,
  UserStatus,
} from '../types/index.js';

// Base API instance
export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// In-memory CSRF Token store
let currentCsrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  currentCsrfToken = token;
}

export function getCsrfToken(): string | null {
  if (currentCsrfToken) return currentCsrfToken;

  // Fallback: read double-submit cookie if accessible
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }
  return null;
}

/**
 * Robust UUID v4 Generator for Idempotency Keys
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback RFC4122 version 4 UUID generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Attach CSRF Token to state-modifying requests
apiClient.interceptors.request.use((config) => {
  const method = config.method?.toUpperCase();
  if (method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const token = getCsrfToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers['X-CSRF-Token'] = token;
    }
  }
  return config;
});

// Capture updated CSRF tokens from responses
apiClient.interceptors.response.use(
  (response) => {
    const headerToken = response.headers['x-csrf-token'];
    if (headerToken && typeof headerToken === 'string') {
      setCsrfToken(headerToken);
    }
    if (response.data && typeof response.data === 'object' && 'csrfToken' in response.data) {
      const dataToken = response.data.csrfToken;
      if (typeof dataToken === 'string') {
        setCsrfToken(dataToken);
      }
    }
    return response;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/**
 * Standardized error message extractor
 */
export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const serverMessage = err.response?.data?.message;
    if (serverMessage && typeof serverMessage === 'string') {
      return serverMessage;
    }
    const serverError = err.response?.data?.error;
    if (serverError && typeof serverError === 'string') {
      return serverError;
    }
    if (err.message) return err.message;
  } else if (err instanceof Error) {
    return err.message;
  }
  return 'An unexpected error occurred. Please try again.';
}

// -------------------------------------------------------------
// Authentication Endpoints
// -------------------------------------------------------------
export const authApi = {
  async register(data: { email: string; fullName: string; password: string }): Promise<{
    message: string;
    user: User;
    account?: Account;
  }> {
    const res = await apiClient.post('/auth/register', data);
    return res.data;
  },

  async login(data: { email: string; password: string }): Promise<{
    message: string;
    user: User;
    csrfToken: string;
  }> {
    const res = await apiClient.post('/auth/login', data);
    if (res.data?.csrfToken) {
      setCsrfToken(res.data.csrfToken);
    }
    return res.data;
  },

  async logout(): Promise<{ message: string }> {
    const res = await apiClient.post('/auth/logout');
    setCsrfToken(null);
    return res.data;
  },

  async getMe(): Promise<{ user: User; csrfToken?: string }> {
    const res = await apiClient.get('/auth/me');
    if (res.data?.csrfToken) {
      setCsrfToken(res.data.csrfToken);
    }
    return res.data;
  },
};

// -------------------------------------------------------------
// Account Management Endpoints
// -------------------------------------------------------------
export const accountApi = {
  async list(): Promise<{ accounts: Account[] }> {
    const res = await apiClient.get('/accounts');
    return res.data;
  },

  async getById(accountId: string): Promise<{ account: Account }> {
    const res = await apiClient.get(`/accounts/${accountId}`);
    return res.data;
  },

  async create(): Promise<{ message: string; account: Account }> {
    const res = await apiClient.post('/accounts');
    return res.data;
  },
};

// -------------------------------------------------------------
// Transfers and Ledger Statements
// -------------------------------------------------------------
export const transferApi = {
  async deposit(params: {
    accountId: string;
    amount: string; // Paise
    description?: string;
    idempotencyKey?: string;
  }): Promise<TransferResult> {
    const key = params.idempotencyKey || generateIdempotencyKey();
    const config: AxiosRequestConfig = {
      headers: {
        'Idempotency-Key': key,
      },
    };
    const res = await apiClient.post(
      '/transfers/deposit',
      {
        accountId: params.accountId,
        amount: params.amount,
        description: params.description,
      },
      config
    );
    return res.data;
  },

  async withdraw(params: {
    accountId: string;
    amount: string; // Paise
    description?: string;
    idempotencyKey?: string;
  }): Promise<TransferResult> {
    const key = params.idempotencyKey || generateIdempotencyKey();
    const config: AxiosRequestConfig = {
      headers: {
        'Idempotency-Key': key,
      },
    };
    const res = await apiClient.post(
      '/transfers/withdraw',
      {
        accountId: params.accountId,
        amount: params.amount,
        description: params.description,
      },
      config
    );
    return res.data;
  },

  async transfer(params: {
    sourceAccountId: string;
    destinationAccountNumber: string;
    amount: string; // Paise
    description?: string;
    idempotencyKey?: string;
  }): Promise<TransferResult> {
    const key = params.idempotencyKey || generateIdempotencyKey();
    const config: AxiosRequestConfig = {
      headers: {
        'Idempotency-Key': key,
      },
    };
    const res = await apiClient.post(
      '/transfers/transfer',
      {
        sourceAccountId: params.sourceAccountId,
        destinationAccountNumber: params.destinationAccountNumber,
        amount: params.amount,
        description: params.description,
      },
      config
    );
    return res.data;
  },

  async getStatement(accountId: string, page = 1, limit = 20): Promise<StatementResponse> {
    const res = await apiClient.get(`/transfers/statement/${accountId}`, {
      params: { page, limit },
    });
    return res.data;
  },
};

// -------------------------------------------------------------
// Admin / Operator Management
// -------------------------------------------------------------
export const adminApi = {
  async listUsers(params?: {
    role?: Role;
    status?: UserStatus;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ users: User[]; pagination: Pagination }> {
    const res = await apiClient.get('/admin/users', { params });
    return res.data;
  },

  async approveUser(userId: string): Promise<{ message: string; user: User }> {
    const res = await apiClient.post(`/admin/users/${userId}/approve`);
    return res.data;
  },

  async rejectUser(userId: string, reason?: string): Promise<{ message: string; user: User }> {
    const res = await apiClient.post(`/admin/users/${userId}/reject`, { reason });
    return res.data;
  },

  async freezeAccount(accountId: string, reason?: string): Promise<{ message: string; account: Account }> {
    const res = await apiClient.post(`/admin/accounts/${accountId}/freeze`, { reason });
    return res.data;
  },

  async unfreezeAccount(accountId: string): Promise<{ message: string; account: Account }> {
    const res = await apiClient.post(`/admin/accounts/${accountId}/unfreeze`);
    return res.data;
  },
};

// -------------------------------------------------------------
// Cryptographic Audit Trail
// -------------------------------------------------------------
export const auditApi = {
  async listLogs(params?: {
    page?: number;
    limit?: number;
    action?: string;
    resource?: string;
    actorId?: string;
  }): Promise<{ logs: AuditLog[]; pagination: Pagination }> {
    const res = await apiClient.get('/audit/logs', { params });
    return res.data;
  },

  async verifyChain(): Promise<AuditVerifyResult> {
    try {
      const res = await apiClient.get('/audit/verify');
      return res.data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        return err.response.data as AuditVerifyResult;
      }
      throw err;
    }
  },
};

