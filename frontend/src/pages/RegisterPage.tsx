import { FC, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { extractErrorMessage } from '../api/client.js';
import { Shield, Lock, Mail, User as UserIcon, AlertCircle, CheckCircle2, Clock, ArrowRight } from 'lucide-react';

export const RegisterPage: FC = () => {
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Registration outcome state
  const [registeredData, setRegisteredData] = useState<{
    email: string;
    fullName: string;
    accountNumber?: string;
  } | null>(null);

  // Live password checklist validation
  const rules = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const isPasswordValid = Object.values(rules).every(Boolean);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setError('Please ensure your password satisfies all security requirements.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      });

      setRegisteredData({
        email: res.user.email,
        fullName: res.user.fullName,
        accountNumber: res.account?.accountNumber,
      });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  // If successfully registered, show compliance pending-approval state
  if (registeredData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="sm:mx-auto sm:w-full sm:max-w-lg relative z-10 px-4">
          <div className="bg-slate-900/90 backdrop-blur-md py-10 px-8 border border-slate-800 rounded-3xl shadow-2xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto mb-5">
              <Clock className="w-8 h-8" />
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              PENDING_APPROVAL
            </span>

            <h2 className="text-2xl font-bold text-white mb-2">Registration Submitted</h2>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              Welcome, <strong className="text-white">{registeredData.fullName}</strong>. Your customer profile has
              been provisioned and is currently pending onboarding approval by an administrator.
            </p>

            {registeredData.accountNumber && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left mb-6">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                  Provisioned Account Number
                </span>
                <span className="font-mono text-base font-semibold text-emerald-400">
                  {registeredData.accountNumber}
                </span>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/40 text-xs text-slate-400 text-left mb-8 space-y-2">
              <p className="font-medium text-slate-300">Banking Security Notice:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Under internal compliance, an Administrator or Operator will review your KYC profile.</li>
                <li>Once approved, your account will transition to ACTIVE status.</li>
                <li>You may sign in immediately to view your onboarding status in real-time.</li>
              </ul>
            </div>

            <Link
              to="/login"
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <span>Proceed to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-slate-950 shadow-xl shadow-emerald-500/20">
            <Shield className="w-8 h-8 fill-current" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-extrabold tracking-tight text-white">
          Create Customer Account
        </h2>
        <p className="mt-1 text-center text-sm text-slate-400">
          Open a new double-entry verified account on BalanceVault
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-slate-900/80 backdrop-blur-md py-8 px-6 sm:px-10 border border-slate-800 rounded-3xl shadow-2xl">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isLoading}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  placeholder="ramesh@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  placeholder="Min 8 chars, 1 upper, 1 digit, 1 special"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Password checklist */}
              <div className="mt-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] space-y-1.5">
                <span className="font-semibold text-slate-400 block mb-1">Security Standards:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className={`flex items-center gap-1.5 ${rules.length ? 'text-emerald-400' : 'text-slate-500'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>8+ characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${rules.upper ? 'text-emerald-400' : 'text-slate-500'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>1 uppercase</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${rules.lower ? 'text-emerald-400' : 'text-slate-500'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>1 lowercase</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${rules.digit ? 'text-emerald-400' : 'text-slate-500'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>1 number</span>
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 ${rules.special ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>1 special symbol (!@#$%^&*)</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !isPasswordValid}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Register Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-emerald-400 hover:text-emerald-300 hover:underline">
              Sign in instead
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

