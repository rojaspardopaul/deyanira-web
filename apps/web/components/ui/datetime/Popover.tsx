'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DateTimeTheme } from './types';

// Popover ligero sin dependencias:
//   • Desktop (>640px): panel flotante anclado al trigger, cierra al hacer
//     click fuera o con Esc.
//   • Mobile (<=640px): hoja full-screen con botones Aplicar/Cancelar.
// Maneja focus-trap básico (primer foco al abrir, Esc para cerrar).

type Props = {
  open: boolean;
  onClose: () => void;
  /** Confirmar selección (solo se muestra el botón en hoja mobile). */
  onApply?: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  title?: string;
  theme?: DateTimeTheme;
  children: ReactNode;
};

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}

export default function Popover({ open, onClose, onApply, anchorRef, title, theme = 'light', children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const dark = theme === 'dark';
  const sheetBg = dark ? 'bg-[#1b0d15] text-white' : 'bg-white';
  const sheetBorder = dark ? 'border-white/10' : 'border-gray-100';
  const cancelText = dark ? 'text-white/50 hover:text-white/80' : 'text-gray-400 hover:text-gray-600';
  const titleText = dark ? 'text-white' : 'text-gray-900';

  // Click fuera (solo desktop) + Esc
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    }
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    }
    document.addEventListener('keydown', onKey, true);
    if (!isMobile) document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose, anchorRef, isMobile]);

  // Foco inicial dentro del panel
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        const focusable = panelRef.current?.querySelector<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select',
        );
        focusable?.focus();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
        <div className={`mt-auto ${sheetBg} rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col animate-fade-up`}>
          <div className={`flex items-center justify-between px-5 pt-4 pb-2 border-b ${sheetBorder} shrink-0`}>
            <span className={`font-bold ${titleText}`}>{title || 'Seleccionar'}</span>
            <button type="button" onClick={onClose} className={`text-sm font-semibold ${cancelText}`}>
              Cancelar
            </button>
          </div>
          <div ref={panelRef} className="overflow-y-auto p-5 flex-1">
            {children}
          </div>
          {onApply && (
            <div className={`p-4 border-t ${sheetBorder} shrink-0`}>
              <button
                type="button"
                onClick={() => { onApply(); onClose(); }}
                className="w-full py-3 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl text-sm transition-colors"
              >
                Aplicar
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={title}
      className={`absolute z-[70] mt-2 left-0 rounded-2xl shadow-2xl border p-3 min-w-[18rem]
        ${dark ? 'bg-[#1b0d15] border-white/10' : 'bg-white border-gray-100'}`}
    >
      {children}
    </div>
  );
}
