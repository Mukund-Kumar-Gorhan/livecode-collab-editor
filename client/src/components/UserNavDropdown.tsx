import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogOut, Settings, Palette, ChevronDown, Shield } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { getUserInitials, getUserColor } from '../utils/colors';
import { ThemeSwitcher } from './ThemeSwitcher';

export const UserNavDropdown: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const initials = getUserInitials(user?.name, user?.email);
  const avatarColor = user?.avatarColor || getUserColor(user?.id || user?.email || 'user');

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2.5 p-1 rounded-lg hover:bg-app-surface-2 transition-colors focus:outline-none focus:ring-1 focus:ring-app-accent"
      >
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={displayName}
            className="w-7 h-7 rounded-full object-cover border border-app-border shadow-sm"
          />
        ) : (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow-sm"
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </div>
        )}
        <div className="hidden sm:flex flex-col text-left">
          <span className="text-xs font-semibold text-app-text leading-tight max-w-[120px] truncate">
            {displayName}
          </span>
          <span className="text-[10px] text-app-text-muted leading-tight max-w-[120px] truncate">
            {user?.email}
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-app-text-muted" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-app-surface border border-app-border shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 divide-y divide-app-border">
          {/* User info banner */}
          <div className="px-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-app-text truncate">{displayName}</p>
              {user?.isAdmin && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-app-accent/20 text-app-accent border border-app-accent/30 tracking-wide uppercase">
                  Admin
                </span>
              )}
            </div>
            <p className="text-[11px] text-app-text-muted truncate">{user?.email}</p>
          </div>

          {/* Links */}
          <div className="py-1">
            {user?.isAdmin && (
              <Link
                to="/admin"
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs text-app-accent hover:text-app-text hover:bg-app-accent/10 transition-colors font-medium mb-0.5"
              >
                <Shield className="w-4 h-4 text-app-accent" />
                <span className="font-semibold">Admin Panel</span>
              </Link>
            )}
            <Link
              to="/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs text-app-text-muted hover:text-app-text hover:bg-app-surface-2 transition-colors font-medium"
            >
              <Settings className="w-4 h-4 text-app-accent" />
              <span>Profile & Settings</span>
            </Link>
          </div>

          {/* Theme Quick Switcher row */}
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-app-text-muted flex items-center space-x-1.5">
              <Palette className="w-3.5 h-3.5 text-app-accent" />
              <span>Theme</span>
            </span>
            <ThemeSwitcher compact />
          </div>

          {/* Logout */}
          <div className="pt-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs text-app-danger hover:bg-app-danger/10 transition-colors font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
