'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Control de paginación reutilizable para tablas/listados admin.
 * Muestra «Anterior / 1 … N / Siguiente» y el rango de resultados.
 */
export default function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
  className = '',
}: {
  page: number;
  totalPages: number;
  total?: number;
  pageSize?: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  // Ventana de páginas visibles alrededor de la actual.
  const pages: (number | '…')[] = [];
  const push = (n: number | '…') => pages.push(n);
  const window = 1;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - window && i <= page + window)) {
      push(i);
    } else if (pages[pages.length - 1] !== '…') {
      push('…');
    }
  }

  const from = pageSize ? (page - 1) * pageSize + 1 : undefined;
  const to = pageSize && total != null ? Math.min(page * pageSize, total) : undefined;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      {total != null && from != null && to != null && (
        <p className="text-xs text-gray-500">
          Mostrando <span className="font-semibold text-gray-700">{from}–{to}</span> de{' '}
          <span className="font-semibold text-gray-700">{total}</span>
        </p>
      )}
      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-2 text-gray-300 text-sm select-none">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`min-w-[34px] h-[34px] px-2 rounded-lg text-sm font-semibold transition-colors ${
                p === page
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
