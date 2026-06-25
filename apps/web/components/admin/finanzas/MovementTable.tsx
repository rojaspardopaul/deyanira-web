'use client';

import { Ban, Paperclip } from 'lucide-react';
import type { FinanceMovement } from '@/features/admin/api/admin.api';
import { fmt, fmtDate, TYPE_LABELS, SOURCE_LABELS, CATEGORY_LABELS, METHOD_LABELS } from './shared';

export default function MovementTable({
  movements, onAnular, onSelect,
}: {
  movements: FinanceMovement[];
  onAnular: (m: FinanceMovement) => void;
  onSelect?: (m: FinanceMovement) => void;
}) {
  if (movements.length === 0) {
    return <div className="p-12 text-center text-gray-400 text-sm">No hay movimientos con estos filtros.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left">
            {['Fecha', 'Concepto', 'Tipo', 'Categoría', 'Método', 'Origen'].map((h) => (
              <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Monto</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => {
            const isIn = m.direction === 'in';
            const voided = m.status === 'void';
            return (
              <tr key={m.id} onClick={() => onSelect?.(m)}
                className={`border-b border-gray-50 hover:bg-gray-50 ${voided ? 'opacity-50' : ''} ${onSelect ? 'cursor-pointer' : ''}`}>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(m.occurredAt)}</td>
                <td className="px-4 py-3 text-gray-800 max-w-[220px] truncate">
                  <span className="inline-flex items-center gap-1.5">
                    {m.description}
                    {m.receiptUrl && <Paperclip className="w-3 h-3 text-gray-400" />}
                    {voided && <Ban className="w-3 h-3 text-gray-400" />}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isIn ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {TYPE_LABELS[m.type] ?? m.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{m.category ? (CATEGORY_LABELS[m.category] ?? m.category) : '—'}</td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{m.paymentMethod ? (METHOD_LABELS[m.paymentMethod] ?? m.paymentMethod) : '—'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{SOURCE_LABELS[m.source] ?? m.source}</td>
                <td className={`px-4 py-3 font-semibold text-right whitespace-nowrap ${voided ? 'line-through text-gray-400' : isIn ? 'text-emerald-600' : 'text-red-500'}`}>
                  {isIn ? '+' : '−'}{fmt(m.amountPen)}
                </td>
                <td className="px-4 py-3 text-right">
                  {!voided && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onAnular(m); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                      title="Anular movimiento"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
