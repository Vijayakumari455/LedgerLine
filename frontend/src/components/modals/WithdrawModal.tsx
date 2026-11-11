import { FC, useState, FormEvent } from 'react';
import { Account } from '../../types/index.js';
import { transferApi, extractErrorMessage } from '../../api/client.js';
import { rupeesToPaise, formatPaiseToRupees } from '../../utils/currency.js';
import { X, ArrowUpRight, AlertCircle, CheckCircle2 } from 'lucide-react';

interface WithdrawModalProps {
  account: Account;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const WithdrawModal: FC<WithdrawModalProps> = ({ account, isOpen, onClose, onSuccess }) => {
  const [amountRupees, setAmountRupees] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const val = parseFloat(amountRupees);
    if (isNaN(val) || val <= 0) {
      setError('Please specify a positive withdrawal amount in ₹.');
      return;
    }

    const requestedPaise = BigInt(rupeesToPaise(amountRupees));
    const availablePaise = BigInt(account.balance);

    if (requestedPaise > availablePaise) {
      setError(`Insufficient funds. Maximum available: ${formatPaiseToRupees(account.balance)}.`);
      return;
    }

    try {
      setIsLoading(true);
      const paise = rupeesToPaise(amountRupees);
      const res = await transferApi.withdraw({
        accountId: account.id,
        amount: paise,
        description: description.trim() || undefined,
      });

      setSuccessMessage(res.message || 'Withdrawal successful');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl shadow-rose-950/20">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Withdraw Funds</h3>
              <p className="text-xs text-slate-400 font-mono">{account.accountNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5 text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-medium text-slate-300">Amount (INR ₹)</label>
              <span className="text-xs text-slate-400">
                Available: <strong className="text-white font-mono">{formatPaiseToRupees(account.balance)}</strong>
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                disabled={isLoading}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
              />
            </div>
            {amountRupees && parseFloat(amountRupees) > 0 && (
              <p className="text-[11px] text-slate-400 mt-1 font-mono">
                Integer minor units: {rupeesToPaise(amountRupees)} paise
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Description (Optional)</label>
            <input
              type="text"
              maxLength={255}
              placeholder="e.g. ATM cash withdrawal"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm Withdrawal'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

