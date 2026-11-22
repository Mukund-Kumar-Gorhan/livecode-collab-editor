import React from 'react';
import { useToastStore } from '../store/toastStore';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-3 sm:bottom-5 left-3 sm:left-auto right-3 sm:right-5 z-50 flex flex-col space-y-2 pointer-events-none max-w-[calc(100vw-1.5rem)] sm:max-w-md">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center justify-between space-x-2.5 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl shadow-2xl border text-xs font-medium backdrop-blur-md transition-all duration-200 transform translate-y-0 opacity-100 ${
            t.type === 'error'
              ? 'bg-app-surface border-app-danger/40 text-app-text shadow-red-500/5'
              : t.type === 'success'
              ? 'bg-app-surface border-app-success/40 text-app-text shadow-emerald-500/5'
              : 'bg-app-surface border-app-accent/40 text-app-text shadow-sky-500/5'
          }`}
        >
          <div className="flex items-center space-x-2 min-w-0">
            {t.type === 'error' && <AlertCircle className="w-4 h-4 text-app-danger shrink-0" />}
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-app-success shrink-0" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-app-accent shrink-0" />}
            <span className="leading-snug break-words max-w-[220px] xs:max-w-xs">{t.message}</span>
          </div>
          <button
            onClick={() => removeToast(t.id)}
            className="ml-2 hover:opacity-80 p-1 rounded text-app-text-muted hover:text-app-text transition shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

