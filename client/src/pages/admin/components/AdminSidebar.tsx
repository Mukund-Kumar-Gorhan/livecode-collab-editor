import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Layers,
  Terminal,
  ShieldCheck,
  History,
  ArrowLeft,
  Shield,
  X,
} from 'lucide-react';

interface AdminSidebarProps {
  onCloseMobile?: () => void;
  isMobileDrawer?: boolean;
}

const NAV_ITEMS = [
  {
    path: '/admin',
    name: 'Overview',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    path: '/admin/users',
    name: 'Users',
    icon: Users,
  },
  {
    path: '/admin/rooms',
    name: 'Rooms',
    icon: Layers,
  },
  {
    path: '/admin/runs',
    name: 'Run Logs',
    icon: Terminal,
  },
  {
    path: '/admin/audit',
    name: 'Audit Log',
    icon: ShieldCheck,
  },
  {
    path: '/admin/logins',
    name: 'Login History',
    icon: History,
  },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  onCloseMobile,
  isMobileDrawer = false,
}) => {
  return (
    <aside className="w-64 h-full bg-app-surface border-r border-app-border flex flex-col justify-between selection:bg-app-accent/20">
      {/* Top Header / Branding */}
      <div>
        <div className="h-14 px-5 border-b border-app-border flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-app-accent/15 border border-app-accent/30 flex items-center justify-center text-app-accent">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-app-text font-heading leading-none block">
                LiveCode Admin
              </span>
              <span className="text-[10px] text-app-accent font-mono uppercase tracking-wider">
                Control Plane
              </span>
            </div>
          </div>

          {/* Close button inside mobile drawer */}
          {isMobileDrawer && (
            <button
              onClick={onCloseMobile}
              className="p-1 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-2 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation list */}
        <nav className="p-3 space-y-1.5">
          <div className="px-3 py-1.5 text-[10px] font-bold text-app-text-muted uppercase tracking-wider">
            Administration
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-app-accent text-app-accent-contrast font-bold shadow-sm'
                      : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-2'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer: Back to LiveCode app */}
      <div className="p-3 border-t border-app-border">
        <Link
          to="/dashboard"
          onClick={onCloseMobile}
          className="flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs text-app-text-muted hover:text-app-text hover:bg-app-surface-2 transition-colors font-medium border border-transparent hover:border-app-border"
        >
          <ArrowLeft className="w-4 h-4 text-app-accent" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    </aside>
  );
};
