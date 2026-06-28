'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

// Select moderno reutilizable (reemplaza los <select> nativos). Trigger estilizado
// + panel desplegable con búsqueda, navegación por teclado y cierre al hacer click
// fuera. Temas 'light' (admin) y 'dark' (wizard/glass). Acento rosa de marca,
// coherente con el DateTimePicker.

export type SelectOption = { value: string; label: string; disabled?: boolean };
type SelectTheme = 'light' | 'dark';

type Props = {
  value: string | null;
  onChange: (value: string) => void;
  /** Opciones: objetos {value,label} o strings (label = value). */
  options: Array<SelectOption | string>;
  theme?: SelectTheme;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  /** Muestra un buscador. Por defecto, activo si hay más de 8 opciones. */
  searchable?: boolean;
  error?: string;
  className?: string;
  ariaLabel?: string;
};

const PINK = '#FF4FA2';

function normalize(options: Array<SelectOption | string>): SelectOption[] {
  return options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
}

export default function Select({
  value, onChange, options, theme = 'light',
  placeholder = 'Seleccionar…', label, disabled, searchable, error, className = '', ariaLabel,
}: Props) {
  const dark = theme === 'dark';
  const opts = useMemo(() => normalize(options), [options]);
  const selected = opts.find((o) => o.value === value) || null;
  const canSearch = searchable ?? opts.length > 8;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);

  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? opts.filter((o) => o.label.toLowerCase().includes(q)) : opts;
  }, [opts, query]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Al abrir: limpiar búsqueda, resaltar el seleccionado, enfocar el buscador
  useEffect(() => {
    if (!open) { setQuery(''); return; }
    const idx = opts.findIndex((o) => o.value === value);
    setActive(idx >= 0 ? idx : 0);
    if (canSearch) requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mantener el índice activo en rango y visible
  useEffect(() => {
    setActive((a) => Math.min(Math.max(a, 0), Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);
  useEffect(() => {
    if (!open) return;
    (listRef.current?.children[active] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function choose(opt: SelectOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    btnRef.current?.focus();
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); }
      return;
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); break;
      case 'ArrowUp': e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); break;
      case 'Enter': e.preventDefault(); if (filtered[active]) choose(filtered[active]); break;
      case 'Escape': e.preventDefault(); setOpen(false); btnRef.current?.focus(); break;
      case 'Home': e.preventDefault(); setActive(0); break;
      case 'End': e.preventDefault(); setActive(filtered.length - 1); break;
    }
  }

  const triggerStyle = dark
    ? { background: 'rgba(255,255,255,0.07)', border: `1px solid ${error ? '#f87171' : 'rgba(255,255,255,0.14)'}`, color: '#fff' }
    : { background: '#fff', border: `1px solid ${error ? '#f87171' : '#e5e7eb'}`, color: '#1f2937' };
  const panelStyle = dark
    ? { background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.12)' }
    : { background: '#fff', border: '1px solid rgba(0,0,0,0.1)' };

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      {label && <label className="block text-xs font-semibold mb-1.5" style={{ color: dark ? '#fff' : '#4b5563' }}>{label}</label>}
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || label}
        style={triggerStyle}
        className="w-full px-4 py-3 rounded-xl flex items-center gap-2 text-left text-sm transition-all
          focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={`flex-1 truncate ${selected ? '' : 'opacity-50'}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl overflow-hidden shadow-lg" style={panelStyle}>
          {canSearch && (
            <div className="p-2" style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: dark ? 'rgba(255,255,255,0.4)' : '#9ca3af' }} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Buscar…"
                  className="w-full pl-8 pr-2 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2"
                  style={dark
                    ? { background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
                    : { background: '#f9fafb', color: '#1f2937', border: '1px solid #e5e7eb' }}
                />
              </div>
            </div>
          )}
          <ul ref={listRef} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.map((o, i) => {
              const isSel = o.value === value;
              const isActive = i === active;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={isSel}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o)}
                  className={`px-4 py-2.5 text-sm flex items-center justify-between gap-2 ${o.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                  style={{
                    background: isActive && !o.disabled ? (dark ? 'rgba(255,79,162,0.18)' : 'rgba(255,79,162,0.12)') : 'transparent',
                    color: isSel ? PINK : dark ? 'rgba(255,255,255,0.85)' : '#374151',
                    fontWeight: isSel ? 700 : 400,
                  }}
                >
                  <span className="truncate">{o.label}</span>
                  {isSel && <Check className="w-4 h-4 shrink-0" />}
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-center" style={{ color: dark ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}>
                Sin resultados
              </li>
            )}
          </ul>
        </div>
      )}

      {error && <p className="text-xs text-red-400 mt-1" role="alert">{error}</p>}
    </div>
  );
}
