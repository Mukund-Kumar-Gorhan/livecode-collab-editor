import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { Shield, Lock, Mail, AlertTriangle, ArrowRight, Code2 } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { adminLogin, user } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(() => {
    if (location.state?.notAdmin) {
      return 'Access Denied: Not an admin account. Standard developer accounts cannot access this portal.';
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in as admin, redirect to admin panel
  React.useEffect(() => {
    if (user?.isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      await adminLogin(cleanEmail, password);
      toast.success('Administrator authenticated successfully');
      const from = (location.state as any)?.from?.pathname || '/admin';
      navigate(from, { replace: true });
    } catch (err: any) {
      const serverCode = err.response?.data?.code;
      const serverMessage = err.response?.data?.message;

      if (serverCode === 'NOT_AN_ADMIN' || serverMessage?.toLowerCase().includes('not an admin')) {
        setError('Access Denied: Not an admin account. Standard accounts cannot access this portal.');
      } else if (serverCode === 'ACCOUNT_DISABLED') {
        setError('This account has been disabled. Please contact the system administrator.');
      } else if (serverCode === 'ADMIN_RATE_LIMIT_EXCEEDED' || err.response?.status === 429) {
        setError('Too many login attempts from this IP. Please wait 15 minutes before retrying.');
      } else {
        setError(serverMessage || 'Invalid email or password.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col justify-between selection:bg-app-accent/30 p-4 sm:p-6">
      {/* Top Header */}
      <header className="flex items-center justify-between max-w-5xl w-full mx-auto py-2">
        <Link to="/" className="flex items-center space-x-2 text-app-accent font-bold">
          <Code2 className="w-5 h-5" />
          <span className="text-base text-app-text font-heading">LiveCode</span>
        </Link>
        <ThemeSwitcher compact />
      </header>

      {/* Main Card */}
      <main className="flex-1 flex items-center justify-center py-8">
        <div className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-150">
          {/* Header & Shield Icon */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-app-accent/15 border border-app-accent/30 flex items-center justify-center text-app-accent mb-3.5 shadow-sm">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-extrabold text-app-text font-heading">
              Admin Portal
            </h1>
            <p className="text-xs text-app-text-muted mt-1">
              LiveCode Platform Control Plane & System Telemetry
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 flex items-start space-x-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs animate-in fade-in duration-100">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Admin Email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              autoComplete="email"
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              isPasswordToggle
              autoComplete="current-password"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2 font-bold"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Access Control Panel
            </Button>
          </form>

          {/* Footer note */}
          <div className="mt-6 pt-5 border-t border-app-border text-center space-y-2">
            <p className="text-[11px] text-app-text-muted">
              Standard developer account?{' '}
              <Link to="/login" className="text-app-accent font-semibold hover:underline">
                Go to Developer Login
              </Link>
            </p>
            <p className="text-[10px] text-app-text-muted/60 font-mono">
              Protected by IP Rate Limiting & Audit Logging
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[11px] text-app-text-muted py-2 font-mono">
        LiveCode Admin Control Plane • Restricted Access
      </footer>
    </div>
  );
};
