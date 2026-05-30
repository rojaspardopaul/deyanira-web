'use client';

import { AlertTriangle } from 'lucide-react';

export type ConfirmDialogConfig = {
  title: string;
  message: string;
  confirmLabel: string;
  confirmClass?: string;
  onConfirm: () => void;
};

export function ConfirmModal({
  dialog,
  onClose,
}: {
  dialog: ConfirmDialogConfig;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-base leading-tight">{dialog.title}</h3>
            <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{dialog.message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            No, volver
          </button>
          <button
            onClick={() => { dialog.onConfirm(); onClose(); }}
            className={`px-5 py-2.5 text-sm font-bold text-white rounded-xl transition-colors ${dialog.confirmClass ?? 'bg-red-600 hover:bg-red-500'}`}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
