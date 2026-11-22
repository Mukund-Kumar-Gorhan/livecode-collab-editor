import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';
import { Code2, ArrowRight, Lock, Mail, Sparkles, Terminal, Cpu, Users } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ThemeSwitcher } from '../components/ThemeSwitcher';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      toast.success('Welcome back to LiveCode!');
      navigate(from, { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Invalid email or password. Please try again.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-app-bg text-app-text selection:bg-app-accent/30">
      {/* Top Floating Theme Switcher */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">
        <ThemeSwitcher compact />
      </div>

      {/* Left Brand / Interactive Code Preview Panel (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-app-surface/60 border-r border-app-border relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-app-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Top */}
        <div className="flex items-center space-x-3 z-10">
          <div className="w-10 h-10 rounded-xl bg-app-accent/15 border border-app-accent/30 flex items-center justify-center text-app-accent shadow-inner">
            <Code2 className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold font-heading text-app-text tracking-tight">LiveCode</span>
        </div>

        {/* Center: Simulated Live Collaborative Code Window */}
        <div className="z-10 my-8">
          <div className="bg-app-surface border border-app-border rounded-2xl shadow-2xl overflow-hidden max-w-md mx-auto">
            {/* Window header */}
            <div className="bg-app-surface-2 px-4 py-3 border-b border-app-border flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
              </div>
              <span className="text-[11px] font-mono text-app-text-muted">collaboration.py</span>
              <div className="flex items-center space-x-1 text-[10px] text-app-success font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-app-success animate-pulse" />
                <span>SYNCED</span>
              </div>
            </div>

            {/* Code Body */}
            <div className="p-5 font-mono text-xs leading-relaxed space-y-2 text-app-text/90">
              <p className="text-app-text-muted italic"># Real-time state synchronized with Yjs CRDTs</p>
              <p>
                <span className="text-app-accent font-semibold">import</span> asyncio
              </p>
              <p>
                <span className="text-app-accent font-semibold">from</span> livecode <span className="text-app-accent font-semibold">import</span> Room, Sandbox
              </p>
              <p className="pt-1">
                <span className="text-app-accent font-semibold">async def</span>{' '}
                <span className="text-yellow-400 font-semibold">pair_programming</span>(session):
              </p>
              <div className="pl-4 space-y-1">
                <p>
                  room = <span className="text-app-accent">await</span> Room.connect(session.code)
                </p>
                <div className="flex items-center space-x-1 relative">
                  <span>room.broadcast(</span>
                  <span className="text-emerald-400">"Hello from Alice!"</span>
                  <span>)</span>
                  {/* Remote Cursor Pill */}
                  <span className="bg-app-accent text-app-accent-contrast text-[9px] font-bold px-1 rounded animate-pulse">
                    Alice |
                  </span>
                </div>
                <p>
                  result = <span className="text-app-accent">await</span> Sandbox.execute(room.code)
                </p>
                <p>
                  <span className="text-app-accent font-semibold">return</span> result.stdout
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 gap-4 z-10 pt-4 border-t border-app-border/80 text-xs">
          <div className="flex items-center space-x-2 text-app-text-muted">
            <Cpu className="w-4 h-4 text-app-accent shrink-0" />
            <span>Docker Sandbox Execution</span>
          </div>
          <div className="flex items-center space-x-2 text-app-text-muted">
            <Users className="w-4 h-4 text-app-accent shrink-0" />
            <span>Real-time Multi-cursor Yjs</span>
          </div>
          <div className="flex items-center space-x-2 text-app-text-muted">
            <Terminal className="w-4 h-4 text-app-accent shrink-0" />
            <span>5 WCAG AA Contrast Themes</span>
          </div>
          <div className="flex items-center space-x-2 text-app-text-muted">
            <Sparkles className="w-4 h-4 text-app-accent shrink-0" />
            <span>Instant Zero-Flash Reload</span>
          </div>
        </div>
      </div>

      {/* Right Authentication Form Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 xs:p-6 sm:p-12">
        <div className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl shadow-2xl p-5 sm:p-8 relative overflow-hidden">
          {/* Subtle top accent highlight */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-app-accent via-indigo-500 to-emerald-500" />

          {/* Form Header */}
          <div className="flex flex-col items-center mb-7 text-center">
            <div className="w-12 h-12 rounded-xl bg-app-accent/15 border border-app-accent/30 flex items-center justify-center text-app-accent mb-3 shadow-inner">
              <Code2 className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-app-text font-heading tracking-tight">
              Sign in to LiveCode
            </h1>
            <p className="text-xs text-app-text-muted mt-1">
              Enter your credentials to access your collaborative workspaces
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-5 p-3 rounded-lg bg-app-danger/15 border border-app-danger/30 text-app-danger text-xs flex items-center space-x-2">
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Password"
              type="password"
              isPasswordToggle
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={<Lock className="w-4 h-4" />}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="w-full mt-2"
            >
              Sign in
            </Button>
          </form>

          {/* Footer Navigation */}
          <div className="mt-6 pt-5 border-t border-app-border text-center text-xs text-app-text-muted">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-app-accent hover:underline font-semibold transition"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
