import { FC, useState, useEffect, FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { accountApi, transferApi, extractErrorMessage, generateIdempotencyKey } from '../api/client.js';
import { Account, TransferResult } from '../types/index.js';
import { formatPaiseToRupees, rupeesToPaise } from '../utils/currency.js';
import {
  ArrowRightLeft,
  AlertCircle,
  CheckCircle2,
  Shield,
  Layers,
  ArrowRight,
  Fingerprint,
} from 'lucide-react';

export const TransferPage: FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

  // Form states
  const [sourceAccountId, setSourceAccountId] = useState<string>('');
  const [destinationAccountNumber, setDestinationAccountNumber] = useState<string>('');
  const [amountRupees, setAmountRupees] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Success result state
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null);
  const [lastIdempotencyKey, setLastIdempotencyKey] = useState<string | null>(null);

  // Load user accounts
  useEffect(() => {
    async function loadAccounts() {
      try {
        setIsLoadingAccounts(true);
        const res = await accountApi.list();
        const activeAccounts = res.accounts || [];
        setAccounts(activeAccounts);

        // Preselect from query params or first active account
        const queryFrom = searchParams.get('from');
        if (queryFrom && activeAccounts.some((a) => a.id === queryFrom)) {
          setSourceAccountId(queryFrom);
        } else if (activeAccounts.length > 0) {
          setSourceAccountId(activeAccounts[0].id);
        }
      } catch (err) {
        setError(extractErrorMessage(err));
      } finally {
        setIsLoadingAccounts(false);
      }
    }

    loadAccounts();
  }, [searchParams]);

  const selectedSourceAccount = accounts.find((a) => a.id === sourceAccountId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setTransferResult(null);

    if (!selectedSourceAccount) {
      setError('Please select a valid source account.');
      return;
    }

    const val = parseFloat(amountRupees);
    if (isNaN(val) || val <= 0) {
      setError('Please specify a positive transfer amount in ₹.');
      return;
    }

    const requestedPaise = BigInt(rupeesToPaise(amountRupees));
    const availablePaise = BigInt(selectedSourceAccount.balance);

    if (requestedPaise > availablePaise) {
      setError(
        `Insufficient funds. Available: ${formatPaiseToRupees(selectedSourceAccount.balance)}, Requested: ${formatPaiseToRupees(
          requestedPaise.toString()
        )}.`
      );
      return;
    }

    if (destinationAccountNumber.trim() === selectedSourceAccount.accountNumber) {
      setError('Self-transfer is prohibited. Source and destination account numbers must be different.');
      return;
    }

    const idempotencyKey = generateIdempotencyKey();
    setLastIdempotencyKey(idempotencyKey);
    setIsSubmitting(true);

    try {
      const res = await transferApi.transfer({
        sourceAccountId: selectedSourceAccount.id,
        destinationAccountNumber: destinationAccountNumber.trim(),
        amount: requestedPaise.toString(),
        description: description.trim() || undefined,
        idempotencyKey,
      });

      setTransferResult(res);
      // Reset input form
      setAmountRupees('');
      setDescription('');
      setDestinationAccountNumber('');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPending = user?.status === 'PENDING_APPROVAL';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <ArrowRightLeft className="w-6 h-6 text-emerald-400" />
          P2P Funds Transfer
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Atomic double-entry ledger transfer with lexicographical lock ordering & cryptographic idempotency
        </p>
      </div>

      {isPending && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-300">
          Your customer account is currently PENDING_APPROVAL. Fund transfers are locked until compliance activation.
        </div>
      )}

      {/* Success Notification Card */}
      {transferResult && (
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-3xl p-6 space-y-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Transfer Executed Successfully</h3>
              <p className="text-xs text-emerald-300/80">Double-entry balanced posting completed</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-900/80 border border-slate-800 rounded-2xl p-4 font-mono">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Transaction Reference</span>
              <span className="text-white font-semibold">{transferResult.transaction.referenceId}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Amount Transferred</span>
              <span className="text-emerald-400 font-bold">{formatPaiseToRupees(transferResult.transaction.amount)}</span>
            </div>
            {lastIdempotencyKey && (
              <div className="sm:col-span-2">
                <span className="text-slate-400 block text-[10px] uppercase flex items-center gap-1">
                  <Fingerprint className="w-3 h-3 text-teal-400" />
                  Idempotency Key (UUID v4)
                </span>
                <span className="text-slate-300 text-[11px] break-all">{lastIdempotencyKey}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setTransferResult(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
            >
              Make Another Transfer
            </button>
            {selectedSourceAccount && (
              <button
                onClick={() => navigate(`/statement?accountId=${selectedSourceAccount.id}`)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors"
              >
                View Account Statement
              </button>
            )}
          </div>
        </div>
      )}

      {/* Transfer Form Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Source Account Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">From Source Account</label>
            {isLoadingAccounts ? (
              <div className="h-11 bg-slate-950 rounded-xl animate-pulse" />
            ) : accounts.length === 0 ? (
              <p className="text-xs text-rose-400">No active accounts available.</p>
            ) : (
              <div className="relative">
                <select
                  value={sourceAccountId}
                  onChange={(e) => setSourceAccountId(e.target.value)}
                  disabled={isSubmitting || isPending}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono appearance-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountNumber} — Available: {formatPaiseToRupees(acc.balance)} ({acc.status})
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
            )}
            {selectedSourceAccount && (
              <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                <span>Account Status: <strong className="text-white font-mono">{selectedSourceAccount.status}</strong></span>
                <span>Max Transferable: <strong className="text-emerald-400 font-mono">{formatPaiseToRupees(selectedSourceAccount.balance)}</strong></span>
              </div>
            )}
          </div>

          {/* Destination Account Number */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">Destination Account Number</label>
            <input
              type="text"
              required
              placeholder="e.g. ACC-INR-123456"
              value={destinationAccountNumber}
              onChange={(e) => setDestinationAccountNumber(e.target.value.toUpperCase())}
              disabled={isSubmitting || isPending}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Recipient account must be an active registered LedgerLine account.
            </p>
          </div>

          {/* Amount in Rupees */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-medium text-slate-300">Transfer Amount (INR ₹)</label>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-base">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                disabled={isSubmitting || isPending}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
              />
            </div>
            {amountRupees && parseFloat(amountRupees) > 0 && (
              <p className="text-[11px] text-slate-400 mt-1.5 font-mono">
                Integer minor units conversion: <strong className="text-emerald-400">{rupeesToPaise(amountRupees)}</strong> paise
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">Transfer Note / Reference (Optional)</label>
            <input
              type="text"
              maxLength={255}
              placeholder="e.g. Invoice settlement or peer transfer"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting || isPending}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Anti-double submission & Idempotency Guarantee note */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3 text-xs text-slate-400">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-300">Financial Idempotency Protection Active</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Every submission generates a unique UUID idempotency key. Network retries or rapid double-clicks will never execute duplicate charges or corrupt the balance sheet.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isPending || accounts.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin" />
                <span>Executing Atomic Transfer...</span>
              </>
            ) : (
              <>
                <span>Execute Transfer</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

