import React from 'react';
import { useToastStore } from '../store/toastStore';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center space-x-2.5 px-4 py-3 rounded-xl shadow-2xl border text-xs font-medium backdrop-blur-md transition-all duration-200 transform translate-y-0 opacity-100 ${
            t.type === 'error'
              ? 'bg-app-surface border-app-danger/40 text-app-text shadow-red-500/5'
              : t.type === 'success'
              ? 'bg-app-surface border-app-success/40 text-app-text shadow-emerald-500/5'
              : 'bg-app-surface border-app-accent/40 text-app-text shadow-sky-500/5'
          }`}
        >
          {t.type === 'error' && <AlertCircle className="w-4 h-4 text-app-danger shrink-0" />}
          {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-app-success shrink-0" />}
          {t.type === 'info' && <Info className="w-4 h-4 text-app-accent shrink-0" />}
          <span className="leading-snug max-w-xs">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="ml-2 hover:opacity-80 p-0.5 rounded text-app-text-muted hover:text-app-text transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

