import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { TransferPage } from './pages/TransferPage.js';
import { StatementPage } from './pages/StatementPage.js';
import { AdminPage } from './pages/AdminPage.js';
import { AuditPage } from './pages/AuditPage.js';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Customer & Core Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/transfer"
                element={
                  <ProtectedRoute>
                    <TransferPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/statement"
                element={
                  <ProtectedRoute>
                    <StatementPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Administrative & Compliance Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'OPERATOR']}>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/audit"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'OPERATOR']}>
                    <AuditPage />
                  </ProtectedRoute>
                }
              />

              {/* Root and Fallback Navigation */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
