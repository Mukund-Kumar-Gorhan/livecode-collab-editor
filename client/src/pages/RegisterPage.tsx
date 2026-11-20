import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';
import { Code2, ArrowRight, Lock, Mail, User, Sparkles, Cpu, Terminal, Users } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ThemeSwitcher } from '../components/ThemeSwitcher';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { register } = useAuthStore();
  const navigate = useNavigate();

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { label: '', score: 0, color: 'bg-app-border' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8) score++;
    if (/[0-9]/.test(pwd) || /[A-Z]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    switch (score) {
      case 1:
        return { label: 'Weak', score: 25, color: 'bg-app-danger' };
      case 2:
        return { label: 'Fair', score: 50, color: 'bg-app-warning' };
      case 3:
        return { label: 'Good', score: 75, color: 'bg-app-accent' };
      case 4:
      default:
        return { label: 'Strong', score: 100, color: 'bg-app-success' };
    }
  };

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    if (!email.trim() || !password) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
      toast.success('Account created successfully! Welcome to LiveCode.');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Registration failed. Please check your inputs.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-app-bg text-app-text selection:bg-app-accent/30">
      {/* Top Floating Theme Switcher */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeSwitcher compact />
      </div>

      {/* Left Brand Panel (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-app-surface/60 border-r border-app-border relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-app-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Top */}
        <div className="flex items-center space-x-3 z-10">
          <div className="w-10 h-10 rounded-xl bg-app-accent/15 border border-app-accent/30 flex items-center justify-center text-app-accent shadow-inner">
            <Code2 className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold font-heading text-app-text tracking-tight">LiveCode</span>
        </div>

        {/* Center Banner */}
        <div className="z-10 my-8 space-y-4 max-w-md">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-app-accent/15 border border-app-accent/30 text-app-accent text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Join Hundreds of Developers</span>
          </div>
          <h2 className="text-3xl font-extrabold text-app-text font-heading leading-tight">
            Code together in real time, from anywhere.
          </h2>
          <p className="text-sm text-app-text-muted leading-relaxed">
            Create rooms in seconds, invite teammates with simple 6-letter room codes, customize your editor preferences, and run code in isolated sandboxes.
          </p>
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
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl shadow-2xl p-8 relative overflow-hidden">
          {/* Subtle top accent highlight */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-app-accent via-indigo-500 to-emerald-500" />

          {/* Form Header */}
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-app-accent/15 border border-app-accent/30 flex items-center justify-center text-app-accent mb-3 shadow-inner">
              <Code2 className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-app-text font-heading tracking-tight">
              Create your account
            </h1>
            <p className="text-xs text-app-text-muted mt-1">
              Get started with collaborative workspaces in seconds
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-5 p-3 rounded-lg bg-app-danger/15 border border-app-danger/30 text-app-danger text-xs flex items-center space-x-2">
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <Input
              label="Full Name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              leftIcon={<User className="w-4 h-4" />}
            />

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
              placeholder="At least 6 characters"
              leftIcon={<Lock className="w-4 h-4" />}
            />

            {/* Password strength meter */}
            {password && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-app-text-muted">Strength:</span>
                  <span className="font-semibold text-app-text">{passwordStrength.label}</span>
                </div>
                <div className="w-full bg-app-surface-2 h-1 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${passwordStrength.color} transition-all duration-300`}
                    style={{ width: `${passwordStrength.score}%` }}
                  />
                </div>
              </div>
            )}

            <Input
              label="Confirm Password"
              type="password"
              isPasswordToggle
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
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
              Create Account
            </Button>
          </form>

          {/* Footer Navigation */}
          <div className="mt-6 pt-5 border-t border-app-border text-center text-xs text-app-text-muted">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-app-accent hover:underline font-semibold transition"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
