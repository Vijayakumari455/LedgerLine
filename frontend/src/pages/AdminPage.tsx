import { FC, useState, useEffect, useCallback } from 'react';
import { adminApi, extractErrorMessage } from '../api/client.js';
import { User, Role, UserStatus } from '../types/index.js';
import { formatPaiseToRupees, formatDateTime } from '../utils/currency.js';
import {
  Users,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Shield,
  X,
} from 'lucide-react';

export const AdminPage: FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Loading and feedback states
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal dialog states
  const [rejectModalUser, setRejectModalUser] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [freezeModalAccount, setFreezeModalAccount] = useState<{ id: string; accountNumber: string } | null>(null);
  const [freezeReason, setFreezeReason] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params: {
        page: number;
        limit: number;
        search?: string;
        role?: Role;
        status?: UserStatus;
      } = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      if (selectedRole !== 'ALL') {
        params.role = selectedRole as Role;
      }
      if (selectedStatus !== 'ALL') {
        params.status = selectedStatus as UserStatus;
      }

      const res = await adminApi.listUsers(params);
      setUsers(res.users);
      setPagination(res.pagination);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery, selectedRole, selectedStatus]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle Approve User
  const handleApprove = async (userId: string) => {
    try {
      setActionLoadingId(userId);
      setError(null);
      const res = await adminApi.approveUser(userId);
      setSuccessMessage(res.message);
      await fetchUsers();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Reject / Suspend User
  const handleConfirmReject = async () => {
    if (!rejectModalUser) return;
    try {
      setActionLoadingId(rejectModalUser.id);
      setError(null);
      const res = await adminApi.rejectUser(rejectModalUser.id, rejectReason.trim() || undefined);
      setSuccessMessage(res.message);
      setRejectModalUser(null);
      setRejectReason('');
      await fetchUsers();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Freeze Account
  const handleConfirmFreeze = async () => {
    if (!freezeModalAccount) return;
    try {
      setActionLoadingId(freezeModalAccount.id);
      setError(null);
      const res = await adminApi.freezeAccount(freezeModalAccount.id, freezeReason.trim() || undefined);
      setSuccessMessage(res.message);
      setFreezeModalAccount(null);
      setFreezeReason('');
      await fetchUsers();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Unfreeze Account
  const handleUnfreeze = async (accountId: string) => {
    try {
      setActionLoadingId(accountId);
      setError(null);
      const res = await adminApi.unfreezeAccount(accountId);
      setSuccessMessage(res.message);
      await fetchUsers();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-emerald-400" />
            User Management & Administrative Control
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Onboard customers, oversee identity verification, and enforce security controls
          </p>
        </div>

        <button
          onClick={fetchUsers}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Feedback Messages */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-400 text-xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-emerald-400 text-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by full name or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          <select
            value={selectedRole}
            onChange={(e) => {
              setSelectedRole(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Roles</option>
            <option value="CUSTOMER">Customer</option>
            <option value="OPERATOR">Operator</option>
            <option value="ADMIN">Admin</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">User Details</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Joined</th>
                <th className="py-3.5 px-4">Associated Accounts</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-2" />
                    Loading user records...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No users matching criteria found.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isActionLoading = actionLoadingId === user.id;
                  const isPending = user.status === 'PENDING_APPROVAL';
                  const isActive = user.status === 'ACTIVE';
                  const isSuspended = user.status === 'SUSPENDED';

                  return (
                    <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Name & Email */}
                      <td className="py-4 px-4 sm:px-6 whitespace-nowrap">
                        <div className="font-semibold text-white">{user.fullName}</div>
                        <div className="text-slate-400 font-mono text-[11px] mt-0.5">{user.email}</div>
                      </td>

                      {/* Role */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded border bg-slate-950 border-slate-800 text-slate-300">
                          <Shield className="w-3 h-3 text-emerald-400" />
                          {user.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                            PENDING_APPROVAL
                          </span>
                        )}
                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            ACTIVE
                          </span>
                        )}
                        {isSuspended && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            SUSPENDED
                          </span>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td className="py-4 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                        {formatDateTime(user.createdAt)}
                      </td>

                      {/* Accounts Mini-List */}
                      <td className="py-4 px-4 min-w-[200px]">
                        {user.accounts && user.accounts.length > 0 ? (
                          <div className="space-y-1.5">
                            {user.accounts.map((acc) => {
                              const isAccountFrozen = acc.status === 'FROZEN';
                              const isAccountLoading = actionLoadingId === acc.id;

                              return (
                                <div
                                  key={acc.id}
                                  className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px]"
                                >
                                  <div>
                                    <span className="font-mono text-slate-300 font-medium">{acc.accountNumber}</span>
                                    <span className="text-emerald-400 font-mono ml-2">
                                      {formatPaiseToRupees(acc.balance)}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                                        isAccountFrozen
                                          ? 'bg-amber-500/20 text-amber-300'
                                          : 'bg-emerald-500/20 text-emerald-300'
                                      }`}
                                    >
                                      {acc.status}
                                    </span>

                                    {/* Freeze / Unfreeze Action Button */}
                                    {isAccountFrozen ? (
                                      <button
                                        onClick={() => handleUnfreeze(acc.id)}
                                        disabled={isAccountLoading}
                                        title="Unfreeze account"
                                        className="p-1 rounded text-teal-400 hover:bg-teal-500/10 transition-colors"
                                      >
                                        <Unlock className="w-3.5 h-3.5" />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => setFreezeModalAccount({ id: acc.id, accountNumber: acc.accountNumber })}
                                        disabled={isAccountLoading}
                                        title="Freeze account"
                                        className="p-1 rounded text-amber-400 hover:bg-amber-500/10 transition-colors"
                                      >
                                        <Lock className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">No accounts</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-2">
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleApprove(user.id)}
                                disabled={isActionLoading}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors disabled:opacity-50"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Approve
                              </button>
                              <button
                                onClick={() => setRejectModalUser(user)}
                                disabled={isActionLoading}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            </>
                          )}

                          {isActive && (
                            <button
                              onClick={() => setRejectModalUser(user)}
                              disabled={isActionLoading}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold bg-slate-950 hover:bg-slate-800 text-rose-400 border border-slate-800 hover:border-rose-500/30 transition-colors disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Suspend User
                            </button>
                          )}

                          {isSuspended && (
                            <button
                              onClick={() => handleApprove(user.id)}
                              disabled={isActionLoading}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors disabled:opacity-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing page <strong className="text-white">{pagination.page}</strong> of{' '}
              <strong className="text-white">{pagination.totalPages}</strong> ({pagination.total} total users)
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page <= 1 || isLoading}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    page: Math.min(pagination.totalPages, prev.page + 1),
                  }))
                }
                disabled={pagination.page >= pagination.totalPages || isLoading}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reject / Suspend User Dialog Modal */}
      {rejectModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-semibold text-white">Suspend / Reject User</h3>
              </div>
              <button
                onClick={() => {
                  setRejectModalUser(null);
                  setRejectReason('');
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-300">
                Are you sure you want to suspend or reject{' '}
                <strong className="text-white">{rejectModalUser.fullName}</strong> ({rejectModalUser.email})? All active
                sessions will be revoked immediately.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Reason (Optional)</label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Failed compliance check or suspicious activity"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setRejectModalUser(null);
                    setRejectReason('');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20"
                >
                  Confirm Suspension
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Freeze Account Dialog Modal */}
      {freezeModalAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-semibold text-white">Emergency Account Freeze</h3>
              </div>
              <button
                onClick={() => {
                  setFreezeModalAccount(null);
                  setFreezeReason('');
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-300">
                Are you sure you want to freeze account{' '}
                <strong className="text-white font-mono">{freezeModalAccount.accountNumber}</strong>? Deposits,
                withdrawals, and transfers involving this account will be immediately blocked by the ledger.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Freeze Reason (Optional)</label>
                <input
                  type="text"
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  placeholder="e.g. Unusual transaction frequency"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFreezeModalAccount(null);
                    setFreezeReason('');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmFreeze}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20"
                >
                  Confirm Freeze
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
