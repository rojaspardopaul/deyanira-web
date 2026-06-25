'use client';

// Botón flotante universal (+) mobile-first con acciones rápidas. Abre el modal
// de captura correspondiente. Las acciones de adelanto/pago/escaneo de voucher se
// incorporan en fases siguientes (IA / conciliación).

import { useState } from 'react';
import { Plus, TrendingDown, TrendingUp, SlidersHorizontal, X } from 'lucide-react';
import CaptureModal, { type CaptureKind } from './CaptureModal';
import ManualMovementModal from './ManualMovementModal';

export default function QuickAddButton({ token, onSaved }: { token: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [capture, setCapture] = useState<CaptureKind | null>(null);
  const [manual, setManual] = useState(false);

  const actions = [
    { key: 'ingreso', label: 'Nuevo ingreso', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50', onClick: () => { setCapture('ingreso'); setOpen(false); } },
    { key: 'egreso', label: 'Nuevo egreso', icon: TrendingDown, color: 'text-red-500 bg-red-50', onClick: () => { setCapture('egreso'); setOpen(false); } },
    { key: 'manual', label: 'Movimiento / ajuste', icon: SlidersHorizontal, color: 'text-indigo-600 bg-indigo-50', onClick: () => { setManual(true); setOpen(false); } },
  ];

  return (
    <>
      {/* Backdrop al abrir el menú */}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}

      <div className="fixed bottom-20 sm:bottom-8 right-5 z-40 flex flex-col items-end gap-3">
        {open && (
          <div className="flex flex-col items-end gap-2 mb-1">
            {actions.map((a) => (
              <button key={a.key} onClick={a.onClick}
                className="flex items-center gap-2 bg-white shadow-lg border border-gray-100 rounded-full pl-3 pr-4 py-2 text-sm font-medium text-gray-700 hover:shadow-xl transition-shadow">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center ${a.color}`}>
                  <a.icon className="w-4 h-4" />
                </span>
                {a.label}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-14 h-14 rounded-full bg-gray-900 text-white shadow-lg flex items-center justify-center hover:bg-gray-800 active:scale-95 transition-all"
          aria-label="Acciones rápidas"
        >
          {open ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>

      {capture && <CaptureModal kind={capture} token={token} onClose={() => setCapture(null)} onSaved={onSaved} />}
      {manual && <ManualMovementModal token={token} onClose={() => setManual(false)} onSaved={onSaved} />}
    </>
  );
}
