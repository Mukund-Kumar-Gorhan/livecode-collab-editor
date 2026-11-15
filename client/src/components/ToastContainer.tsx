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
          className={`pointer-events-auto flex items-center space-x-2.5 px-4 py-3 rounded-lg shadow-xl border text-xs font-medium backdrop-blur-md transition-all duration-200 transform translate-y-0 opacity-100 ${
            t.type === 'error'
              ? 'bg-[#2a1215]/90 border-red-500/40 text-red-200'
              : t.type === 'success'
              ? 'bg-[#0f2419]/90 border-emerald-500/40 text-emerald-200'
              : 'bg-[#18202f]/90 border-sky-500/40 text-sky-200'
          }`}
        >
          {t.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
          {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {t.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0" />}
          <span className="leading-snug max-w-xs">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="ml-2 hover:opacity-80 p-0.5 rounded text-gray-400 hover:text-white transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
