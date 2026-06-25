'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, X, Check, Clock, Plus, Scissors } from 'lucide-react';
import { focalImg } from '@/lib/cloudinary-client';
import { getCategoryTheme } from '@/lib/categoryTheme';

// Popup para agregar servicios extra a una reserva sin contaminar la pantalla.
// Incluye buscador, filtro por categorías y selección múltiple. Al confirmar,
// devuelve los servicios elegidos vía onAdd() y se cierra.

type Service = {
  id: string; name: string; duration: number; pricePen: number;
  description?: string; categoryId?: string | null;
  imageUrl?: string | null;
  category?: { id: string; name: string; slug?: string | null } | null;
  [key: string]: unknown;
};
type Category = { id: string; name: string; icon?: string | null; slug?: string };

export default function AddServiceModal({
  services, categories, selectedIds, onAdd, onClose,
}: {
  services: Service[];
  categories: Category[];
  selectedIds: Set<string>;
  onAdd: (services: Service[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery]       = useState('');
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [picked, setPicked]     = useState<Set<string>>(new Set());

  // Bloquea el scroll del body mientras el modal está abierto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Cierra con tecla Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const available = useMemo(
    () => services.filter(s => !selectedIds.has(s.id)),
    [services, selectedIds],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return available.filter(s => {
      const inCat = !activeCat || s.categoryId === activeCat || s.category?.id === activeCat;
      const inQ   = !q || s.name.toLowerCase().includes(q) ||
                    (s.description || '').toLowerCase().includes(q);
      return inCat && inQ;
    });
  }, [available, activeCat, query]);

  function togglePick(id: string) {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function confirm() {
    const chosen = available.filter(s => picked.has(s.id));
    if (chosen.length === 0) return;
    onAdd(chosen);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden animate-slideup"
        style={{
          background: '#141414',
          border: '1px solid rgba(255,255,255,0.1)',
          maxHeight: '88vh',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
        }}>

        {/* Header */}
        <div className="px-5 pt-4 pb-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Grabber móvil */}
          <div className="w-10 h-1 rounded-full mx-auto mb-3 sm:hidden" style={{ background: 'rgba(255,255,255,0.2)' }} />
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-lg text-white">Agregar servicio</h3>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
              style={{ background: 'rgba(255,255,255,0.08)' }} aria-label="Cerrar">
              <X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
            </button>
          </div>

          {/* Buscador */}
          <div className="relative mt-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.35)' }} />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar servicio…"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255,79,162,0.5)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
            />
          </div>

          {/* Categorías */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 -mx-1 px-1">
            <button onClick={() => setActiveCat(null)}
              className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={activeCat === null
                ? { background: 'linear-gradient(135deg, #FF4FA2, #e6368a)', color: '#fff' }
                : { background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}>
              Todos
            </button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={activeCat === cat.id
                  ? { background: 'linear-gradient(135deg, #FF4FA2, #e6368a)', color: '#fff' }
                  : { background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}>
                {cat.icon && <span className="mr-1">{cat.icon}</span>}{cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de servicios */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Scissors className="w-9 h-9 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {available.length === 0 ? 'Ya agregaste todos los servicios disponibles' : 'Sin resultados para tu búsqueda'}
              </p>
            </div>
          ) : (
            filtered.map(s => {
              const on = picked.has(s.id);
              const t = getCategoryTheme(s.category?.slug, s.category?.name);
              const im = s.imageUrl ? focalImg(s.imageUrl, 220) : null;
              return (
                <button key={s.id} onClick={() => togglePick(s.id)}
                  className="w-full text-left rounded-2xl p-2.5 transition-all duration-200 active:scale-[0.98]"
                  style={{
                    background: '#fff',
                    border: on ? `2px solid ${t.accent}` : '2px solid transparent',
                    boxShadow: on ? `0 6px 18px ${t.accent}40` : '0 2px 10px rgba(0,0,0,0.18)',
                  }}>
                  <div className="flex items-center gap-3">
                    {/* Thumb: imagen real o degradado+emoji de la categoría */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center text-xl shrink-0"
                      style={{ background: t.gradient, boxShadow: `0 3px 10px ${t.accent}33` }}>
                      {im
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={im.src} alt={s.name} loading="lazy" decoding="async" className="w-full h-full object-cover" style={{ objectPosition: im.objectPosition }} />
                        : <span aria-hidden="true">{t.emoji}</span>}
                    </div>

                    <div className="flex-1 min-w-0">
                      {s.category?.name && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mb-1"
                          style={{ background: t.soft, color: t.chipText }}>
                          {t.emoji} {s.category.name}
                        </span>
                      )}
                      <p className="font-bold text-[13.5px] leading-tight line-clamp-1" style={{ color: '#171013' }}>{s.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 shrink-0" style={{ color: t.accent }} />
                        <span className="text-[11px] font-medium" style={{ color: '#9b8089' }}>{s.duration} min</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="font-extrabold text-[15px]" style={{ color: '#171013' }}>S/{Number(s.pricePen).toFixed(0)}</span>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
                        style={on
                          ? { background: t.accent, boxShadow: `0 2px 8px ${t.accent}55` }
                          : { background: '#f1edef', border: '1.5px solid #e2dadf' }}>
                        {on
                          ? <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                          : <Plus className="w-3.5 h-3.5" style={{ color: '#b3a1a9' }} />}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pt-3 pb-5 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)' }}>
          <button onClick={confirm} disabled={picked.size === 0}
            className="w-full py-3.5 rounded-full font-bold text-sm text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              background: picked.size > 0 ? 'linear-gradient(135deg, #FF4FA2, #e6368a)' : 'rgba(255,79,162,0.4)',
              boxShadow: picked.size > 0 ? '0 4px 16px rgba(255,79,162,0.4)' : 'none',
            }}>
            <Plus className="w-4 h-4" />
            {picked.size === 0
              ? 'Agregar servicio'
              : `Agregar ${picked.size} servicio${picked.size > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
