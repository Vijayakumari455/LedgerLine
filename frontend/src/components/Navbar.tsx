import { FC, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import {
  Shield,
  Layers,
  ArrowRightLeft,
  FileText,
  Users,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

export const Navbar: FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      navigate('/login');
    } catch {
      // Ignore logout errors and redirect anyway
      navigate('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const isStaff = user.role === 'ADMIN' || user.role === 'OPERATOR';

  const navLinks = [
    { label: 'Accounts', to: '/dashboard', icon: Layers },
    { label: 'Transfer', to: '/transfer', icon: ArrowRightLeft },
    { label: 'Statements', to: '/statement', icon: FileText },
    ...(isStaff
      ? [
          { label: 'User Control', to: '/admin', icon: Users },
          { label: 'Audit Chain', to: '/audit', icon: ShieldCheck },
        ]
      : []),
  ];

  const getStatusBadge = () => {
    switch (user.status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Active
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Pending Approval
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            Suspended
          </span>
        );
    }
  };

  return (
    <nav className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Shield className="w-5 h-5 fill-current" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                  LedgerLine
                </span>
                <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-400 border border-slate-700">
                  Core
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-slate-800 text-emerald-400 border border-slate-700/60 shadow-inner'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right Section: User Info and Logout */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              {getStatusBadge()}
              <span className="px-2 py-0.5 rounded text-xs font-mono font-medium uppercase bg-slate-800 text-slate-300 border border-slate-700">
                {user.role}
              </span>
            </div>

            <div className="h-6 w-px bg-slate-800" />

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-200 leading-none">{user.fullName}</p>
                <p className="text-xs text-slate-400 leading-tight mt-0.5">{user.email}</p>
              </div>

              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="Sign out of LedgerLine"
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile hamburger menu button */}
          <div className="flex md:hidden items-center gap-2">
            {getStatusBadge()}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900/95 px-4 pt-3 pb-4 space-y-2">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <p className="text-sm font-semibold text-white">{user.fullName}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
            <span className="px-2 py-0.5 rounded text-xs font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
              {user.role}
            </span>
          </div>

          <div className="pt-2 space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                    isActive
                      ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

