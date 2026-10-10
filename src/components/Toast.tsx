import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cn } from '../lib/utils';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

type ToastTone = 'success' | 'info' | 'error';

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur-sm',
              toast.tone === 'success' && 'border-emerald-500/30 bg-slate-900/95 text-emerald-100',
              toast.tone === 'info' && 'border-slate-600 bg-slate-900/95 text-slate-100',
              toast.tone === 'error' && 'border-red-500/30 bg-slate-900/95 text-red-100'
            )}>
            {toast.tone === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            )}
            <p className="flex-1">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="text-slate-400 hover:text-slate-200"
              aria-label="Dismiss notification">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
