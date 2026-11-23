import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AdminSidebar } from './components/AdminSidebar';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import { UserNavDropdown } from '../../components/UserNavDropdown';
import { Menu, Shield } from 'lucide-react';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/admin': {
    title: 'Platform Overview',
    subtitle: 'System health, metrics, and language telemetry',
  },
  '/admin/users': {
    title: 'User Management',
    subtitle: 'Manage accounts, privileges, and membership status',
  },
  '/admin/rooms': {
    title: 'Room Directory',
    subtitle: 'Inspect collaborative rooms and clean up inactive sessions',
  },
  '/admin/runs': {
    title: 'Execution Telemetry',
    subtitle: 'Container sandbox execution logs, exit codes, and output',
  },
  '/admin/audit': {
    title: 'Audit Trail',
    subtitle: 'Security and administrative action logs',
  },
};

export const AdminLayout: React.FC = () => {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const location = useLocation();

  const currentPath = location.pathname.endsWith('/') && location.pathname.length > 1
    ? location.pathname.slice(0, -1)
    : location.pathname;

  const currentMeta = PAGE_TITLES[currentPath] || {
    title: 'Admin Control Center',
    subtitle: 'System administration and management',
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col md:flex-row selection:bg-app-accent/20">
      {/* Desktop Persistent Left Sidebar */}
      <div className="hidden md:flex shrink-0 h-screen sticky top-0">
        <AdminSidebar />
      </div>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
          />

          {/* Slide-over Drawer */}
          <div className="relative z-10 w-72 h-full shadow-2xl animate-in slide-in-from-left duration-200">
            <AdminSidebar
              isMobileDrawer
              onCloseMobile={() => setIsMobileDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-14 bg-app-surface border-b border-app-border px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
          {/* Left: Mobile hamburger & breadcrumbs */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="p-1.5 -ml-1 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-2 md:hidden transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-app-accent/15 border border-app-accent/30 flex items-center justify-center text-app-accent md:hidden">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <h1 className="text-sm sm:text-base font-bold text-app-text font-heading truncate">
                {currentMeta.title}
              </h1>
            </div>
          </div>

          {/* Right: Theme switcher and user avatar */}
          <div className="flex items-center space-x-3">
            <ThemeSwitcher compact />
            <UserNavDropdown />
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
