import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';
import { Loader2 } from 'lucide-react';

export const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, isInitialized, isLoading } = useAuthStore();
  const location = useLocation();
  const hasNotifiedRef = useRef(false);

  useEffect(() => {
    if (isInitialized && user && !user.isAdmin && !hasNotifiedRef.current) {
      hasNotifiedRef.current = true;
      toast.error('Access denied: Administrator privileges required');
    }
  }, [isInitialized, user]);

  if (!isInitialized && isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-app-bg text-app-text-muted">
        <Loader2 className="w-8 h-8 text-app-accent animate-spin mb-3" />
        <span className="text-xs font-mono text-app-text-muted">Verifying administrator permissions...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (!user.isAdmin) {
    return <Navigate to="/admin/login" state={{ from: location, notAdmin: true }} replace />;
  }

  return children;
};
