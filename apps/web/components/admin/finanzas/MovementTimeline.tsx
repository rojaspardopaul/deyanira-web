'use client';

// Timeline tipo app bancaria: movimientos cronológicos con monto ± y concepto.

import { ArrowDownLeft, ArrowUpRight, Paperclip, Ban } from 'lucide-react';
import type { FinanceMovement } from '@/features/admin/api/admin.api';
import { fmt, fmtDate, TYPE_LABELS, SOURCE_LABELS, METHOD_LABELS } from './shared';

export default function MovementTimeline({
  movements, onSelect,
}: {
  movements: FinanceMovement[];
  onSelect?: (m: FinanceMovement) => void;
}) {
  if (movements.length === 0) {
    return <div className="py-10 text-center text-gray-400 text-sm">No hay movimientos en este período.</div>;
  }

  return (
    <ul className="divide-y divide-gray-50">
      {movements.map((m) => {
        const isIn = m.direction === 'in';
        const voided = m.status === 'void';
        return (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onSelect?.(m)}
              disabled={!onSelect}
              className={`w-full flex items-center gap-3 py-3 px-1 text-left ${onSelect ? 'hover:bg-gray-50 rounded-lg' : ''} ${voided ? 'opacity-50' : ''}`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isIn ? 'bg-emerald-100' : 'bg-red-100'}`}>
                {isIn ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" /> : <ArrowUpRight className="w-4 h-4 text-red-500" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-gray-800 truncate">{m.description}</p>
                  {m.receiptUrl && <Paperclip className="w-3 h-3 text-gray-400 shrink-0" />}
                  {voided && <Ban className="w-3 h-3 text-gray-400 shrink-0" />}
                </div>
                <p className="text-xs text-gray-400 truncate">
                  {fmtDate(m.occurredAt)} · {TYPE_LABELS[m.type] ?? m.type}
                  {m.source !== 'manual' && ` · ${SOURCE_LABELS[m.source] ?? m.source}`}
                  {m.paymentMethod && ` · ${METHOD_LABELS[m.paymentMethod] ?? m.paymentMethod}`}
                </p>
              </div>
              <span className={`text-sm font-semibold whitespace-nowrap ${voided ? 'line-through text-gray-400' : isIn ? 'text-emerald-600' : 'text-red-500'}`}>
                {isIn ? '+' : '−'}{fmt(m.amountPen).replace('S/ ', 'S/ ')}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
