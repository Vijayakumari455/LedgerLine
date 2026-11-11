import { FC, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { accountApi, transferApi, extractErrorMessage } from '../api/client.js';
import { Account, StatementResponse } from '../types/index.js';
import { formatPaiseToRupees, formatDateTime } from '../utils/currency.js';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
} from 'lucide-react';

export const StatementPage: FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [statementData, setStatementData] = useState<StatementResponse | null>(null);

  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(20);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch user accounts to populate account selector
  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await accountApi.list();
        const userAccounts = res.accounts || [];
        setAccounts(userAccounts);

        const paramId = searchParams.get('accountId');
        if (paramId && userAccounts.some((a) => a.id === paramId)) {
          setSelectedAccountId(paramId);
        } else if (userAccounts.length > 0) {
          setSelectedAccountId(userAccounts[0].id);
        }
      } catch (err) {
        setError(extractErrorMessage(err));
      }
    }

    loadAccounts();
  }, [searchParams]);

  // 2. Fetch statement for selected account
  const fetchStatement = useCallback(async () => {
    if (!selectedAccountId) return;

    try {
      setIsLoading(true);
      setError(null);
      const res = await transferApi.getStatement(selectedAccountId, page, limit);
      setStatementData(res);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccountId, page, limit]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  const handleAccountChange = (newId: string) => {
    setSelectedAccountId(newId);
    setPage(1);
    setSearchParams({ accountId: newId });
  };

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-emerald-400" />
            Account Statements & Ledger
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Cryptographically audited running-balance ledger history
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Account Selector */}
          {accounts.length > 0 && (
            <div className="relative">
              <select
                value={selectedAccountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none pr-8"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.accountNumber} ({formatPaiseToRupees(acc.balance)})
                  </option>
                ))}
              </select>
              <Layers className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          <button
            onClick={fetchStatement}
            disabled={isLoading || !selectedAccountId}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Account Balance Summary Card */}
      {selectedAccount && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-bold text-white">{selectedAccount.accountNumber}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {selectedAccount.status}
              </span>
            </div>
            <p className="text-xs text-slate-400">Currency: {selectedAccount.currency}</p>
          </div>

          <div className="sm:text-right">
            <span className="text-xs text-slate-400 block mb-0.5">Current Balance</span>
            <span className="text-2xl font-extrabold text-white tracking-tight font-mono">
              {formatPaiseToRupees(selectedAccount.balance)}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Statement Table Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Timestamp</th>
                <th className="py-3.5 px-4">Reference ID</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Entry</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
                <th className="py-3.5 px-4 text-right">Running Balance</th>
                <th className="py-3.5 px-4 sm:px-6">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-2" />
                    Fetching double-entry ledger statement...
                  </td>
                </tr>
              ) : !statementData || statementData.statement.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No transactions recorded for this account.
                  </td>
                </tr>
              ) : (
                statementData.statement.map((entry) => {
                  const isCredit = entry.entryType === 'CREDIT';
                  return (
                    <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 text-slate-300 whitespace-nowrap">
                        {formatDateTime(entry.timestamp)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                        {entry.referenceId}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">
                        {entry.type}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold ${
                            isCredit ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isCredit ? (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          )}
                          {entry.entryType}
                        </span>
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap ${
                          isCredit ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isCredit ? '+' : '-'} {formatPaiseToRupees(entry.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-200 whitespace-nowrap">
                        {formatPaiseToRupees(entry.balanceAfter)}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-slate-400 max-w-xs truncate">
                        {entry.description || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {statementData && statementData.pagination.totalPages > 1 && (
          <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing page <strong className="text-white">{statementData.pagination.page}</strong> of{' '}
              <strong className="text-white">{statementData.pagination.totalPages}</strong> (
              {statementData.pagination.total} total postings)
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={statementData.pagination.page <= 1 || isLoading}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(statementData.pagination.totalPages, p + 1))}
                disabled={statementData.pagination.page >= statementData.pagination.totalPages || isLoading}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

