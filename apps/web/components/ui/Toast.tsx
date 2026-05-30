'use client';

import { useEffect } from 'react';
import { Check, AlertCircle, X } from 'lucide-react';

export type ToastState = { type: 'success' | 'error'; msg: string } | null;

export function Toast({ toast, onClose, duration = 3500 }: {
  toast: ToastState;
  onClose: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [toast, onClose, duration]);

  if (!toast) return null;

  const isOk = toast.type === 'success';
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4">
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl max-w-sm"
        style={{
          background: isOk ? '#10b981' : '#ef4444',
          color: '#fff',
        }}
      >
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          {isOk ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
        </div>
        <p className="text-sm font-semibold flex-1">{toast.msg}</p>
        <button onClick={onClose} className="opacity-80 hover:opacity-100 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
