import { FC, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { accountApi, extractErrorMessage } from '../api/client.js';
import { Account } from '../types/index.js';
import { formatPaiseToRupees } from '../utils/currency.js';
import { DepositModal } from '../components/modals/DepositModal.js';
import { WithdrawModal } from '../components/modals/WithdrawModal.js';
import { CreateAccountModal } from '../components/modals/CreateAccountModal.js';
import {
  Wallet,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  FileText,
  Clock,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Building,
} from 'lucide-react';

export const DashboardPage: FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Copied indicator
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await accountApi.list();
      setAccounts(res.accounts || []);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Compute total balance in paise
  const totalBalancePaise = accounts.reduce((acc, account) => {
    return acc + BigInt(account.balance || '0');
  }, BigInt(0));

  const isPending = user?.status === 'PENDING_APPROVAL';
  const isSuspended = user?.status === 'SUSPENDED';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Pending Approval Compliance Banner */}
      {isPending && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-300">Account Onboarding Under Review</h3>
            <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
              Your customer registration is currently pending compliance approval from an Administrator or Operator.
              Deposit, withdrawal, and P2P transfer capabilities will be automatically unlocked once your profile is approved.
            </p>
          </div>
        </div>
      )}

      {/* Suspended Account Banner */}
      {isSuspended && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-rose-300">Account Suspended</h3>
            <p className="text-xs text-rose-200/80 mt-1 leading-relaxed">
              Your profile has been marked as suspended by system security operations. Financial capabilities are locked.
              Please contact compliance support for assistance.
            </p>
          </div>
        </div>
      )}

      {/* Page Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Financial Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Overview of your active multi-currency accounts and balance ledger
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAccounts}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            disabled={isPending || isSuspended}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            New Account
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total Net Worth Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-slate-400">Total Net Balance</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {formatPaiseToRupees(totalBalancePaise)}
          </div>
          <p className="text-xs text-slate-400 mt-2">Aggregated across {accounts.length} registered accounts</p>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Total Accounts Count Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-slate-400">Active Ledger Accounts</span>
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{accounts.length}</div>
          <p className="text-xs text-slate-400 mt-2">Double-entry verified balance vaults</p>
        </div>

        {/* Primary Account Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-slate-400">Primary Account</span>
            <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
              INR
            </span>
          </div>
          <div className="text-lg font-mono font-bold text-emerald-400 truncate">
            {accounts[0]?.accountNumber || 'Pending Provisioning'}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Status:{' '}
            <span className="font-semibold text-slate-200">
              {accounts[0]?.status || (isPending ? 'PENDING_APPROVAL' : 'ACTIVE')}
            </span>
          </p>
        </div>
      </div>

      {/* Accounts List Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Your Accounts</h2>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse p-6" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-3xl bg-slate-900/40 border border-slate-800 p-12 text-center">
            <Wallet className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-white">No accounts found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Your user profile currently has no associated accounts. Click "New Account" to open your first INR vault.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors"
            >
              Open Account
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {accounts.map((account) => {
              const isFrozen = account.status === 'FROZEN';
              return (
                <div
                  key={account.id}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-6 hover:border-slate-700/80 transition-all"
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-slate-300">{account.accountNumber}</span>
                        <button
                          onClick={() => copyToClipboard(account.accountNumber, account.id)}
                          className="p-1 rounded text-slate-500 hover:text-white transition-colors"
                          title="Copy account number"
                        >
                          {copiedId === account.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                          account.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : account.status === 'FROZEN'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {account.status}
                      </span>
                    </div>

                    <div className="text-2xl font-extrabold text-white tracking-tight mt-3">
                      {formatPaiseToRupees(account.balance)}
                    </div>
                    <span className="text-[11px] text-slate-400">Available Balance ({account.currency})</span>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => {
                        setSelectedAccount(account);
                        setIsDepositOpen(true);
                      }}
                      disabled={isPending || isSuspended || isFrozen}
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium bg-slate-950 hover:bg-slate-800 text-emerald-400 border border-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      Deposit
                    </button>

                    <button
                      onClick={() => {
                        setSelectedAccount(account);
                        setIsWithdrawOpen(true);
                      }}
                      disabled={isPending || isSuspended || isFrozen}
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium bg-slate-950 hover:bg-slate-800 text-rose-400 border border-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      Withdraw
                    </button>

                    <button
                      onClick={() => navigate(`/transfer?from=${account.id}`)}
                      disabled={isPending || isSuspended || isFrozen}
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-teal-400" />
                      Transfer
                    </button>

                    <button
                      onClick={() => navigate(`/statement?accountId=${account.id}`)}
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      Statement
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedAccount && (
        <>
          <DepositModal
            account={selectedAccount}
            isOpen={isDepositOpen}
            onClose={() => setIsDepositOpen(false)}
            onSuccess={fetchAccounts}
          />
          <WithdrawModal
            account={selectedAccount}
            isOpen={isWithdrawOpen}
            onClose={() => setIsWithdrawOpen(false)}
            onSuccess={fetchAccounts}
          />
        </>
      )}

      <CreateAccountModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={fetchAccounts}
      />
    </div>
  );
};

