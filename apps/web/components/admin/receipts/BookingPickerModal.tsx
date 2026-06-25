'use client';

import { useMemo, useState } from 'react';
import { X, Search, CalendarClock, Sparkles } from 'lucide-react';
import type { CustomerBooking } from '@/features/receipts/api/receipts.api';
import { RESERVA_STATUS, money, fmtDate } from './labels';

// Popup para elegir una reserva del cliente y vincularla al recibo. Lista las
// últimas reservas (5 + "ver más") con buscador por servicio, estado y adelanto.
export default function BookingPickerModal({
  bookings,
  selectedId,
  onSelect,
  onClose,
}: {
  bookings: CustomerBooking[];
  selectedId: string | null;
  onSelect: (b: CustomerBooking | null) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? bookings.filter((b) => b.label.toLowerCase().includes(t)) : bookings;
  }, [bookings, q]);
  const visible = showAll ? filtered : filtered.slice(0, 5);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[88vh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="font-display font-bold text-base text-gray-900">Vincular una reserva</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setShowAll(false); }}
              placeholder="Buscar por servicio…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {visible.map((b) => {
            const active = selectedId === b.bookingGroupId;
            const paid = b.deposit?.paidPen || 0;
            const rs = RESERVA_STATUS[b.status] || RESERVA_STATUS.confirmed;
            return (
              <button
                key={b.bookingGroupId}
                onClick={() => { onSelect(b); onClose(); }}
                className={`w-full text-left rounded-xl border p-3 transition-all ${active ? 'border-pink-400 bg-pink-50/50 ring-2 ring-pink-100' : 'border-gray-200 hover:border-pink-300 hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-gray-800 flex items-center gap-1.5 min-w-0">
                    {b.isPackage ? <Sparkles className="w-3.5 h-3.5 text-pink-400 shrink-0" /> : <CalendarClock className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                    <span className="truncate">{b.label}</span>
                  </span>
                  <span className="text-sm font-bold text-gray-900 shrink-0">{money(b.total)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-500 flex-wrap">
                  <span className={`font-bold px-1.5 py-0.5 rounded-full ${rs.cls}`}>{rs.label}</span>
                  <span>{fmtDate(b.date)}</span>
                  {b.deposit ? (
                    b.deposit.balancePen <= 0 && paid > 0
                      ? <span className="text-green-600 font-semibold">Pagado {money(paid)}</span>
                      : paid > 0
                        ? <span className="text-green-600 font-semibold">Pagado {money(paid)} · saldo {money(b.deposit.balancePen)}</span>
                        : <span className="text-amber-600 font-semibold">Adelanto pendiente</span>
                  ) : <span className="text-gray-400">Sin adelanto</span>}
                </div>
              </button>
            );
          })}

          {!showAll && filtered.length > 5 && (
            <button onClick={() => setShowAll(true)} className="w-full text-center text-xs font-semibold text-pink-600 hover:text-pink-700 py-1.5">
              Ver más ({filtered.length - 5})
            </button>
          )}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Ninguna reserva coincide con “{q}”.</p>
          )}
        </div>

        <div className="border-t border-gray-100 px-5 py-3">
          <button
            onClick={() => { onSelect(null); onClose(); }}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Sin reserva — cobro libre
          </button>
        </div>
      </div>
    </div>
  );
}
