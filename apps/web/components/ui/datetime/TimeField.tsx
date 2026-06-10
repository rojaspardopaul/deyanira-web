'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { to12h } from './utils';
import { getTokens } from './theme';
import type { DateTimeTheme } from './types';

// Entrada de hora segmentada estilo librería: cajas [Horas] [Minutos] [Período]
// con auto-avance (al completar las horas el foco salta a minutos). Sin segundos.
// Emite 'HH:mm' (24h) en cuanto hay una hora numéricamente completa; la
// validación de disponibilidad la hace el contenedor (TimeList).

type Props = {
  value: string | null;            // 'HH:mm' 24h
  onCommit: (hhmm: string) => void;
  hourFormat?: '12h' | '24h';
  theme?: DateTimeTheme;
  invalid?: boolean;               // marca visual de error (lo decide el contenedor)
  onFocusChange?: (focused: boolean) => void;
};

function pad2(n: number) { return String(n).padStart(2, '0'); }

export default function TimeField({
  value, onCommit, hourFormat = '12h', theme = 'light', invalid, onFocusChange,
}: Props) {
  const t = getTokens(theme);
  const is12 = hourFormat === '12h';

  const [h, setH] = useState('');
  const [m, setM] = useState('');
  const [period, setPeriod] = useState<'am' | 'pm'>('am');
  const hRef = useRef<HTMLInputElement>(null);
  const mRef = useRef<HTMLInputElement>(null);
  const focused = useRef(false);
  // La primera edición tras enfocar un segmento empieza de cero (toma solo el
  // dígito recién tecleado). Evita que un campo PRE-RELLENADO (p. ej. el horario
  // por defecto) complete 2 dígitos al primer toque y salte de campo sin dejar
  // escribir el segundo dígito (no dependemos de que select() reemplace).
  const fresh = useRef(false);

  // Sincronizar con el valor externo cuando no se está editando
  useEffect(() => {
    if (focused.current) return;
    if (value && /^\d{2}:\d{2}$/.test(value)) {
      if (is12) {
        const { hour12, minute, meridiem } = to12h(value);
        setH(String(hour12)); setM(pad2(minute)); setPeriod(meridiem);
      } else {
        setH(value.slice(0, 2)); setM(value.slice(3, 5));
      }
    } else {
      setH(''); setM('');
    }
  }, [value, is12]);

  function buildAndCommit(hh: string, mm: string, per: 'am' | 'pm') {
    if (hh === '' || mm === '') return;
    let hour = parseInt(hh, 10);
    const min = parseInt(mm, 10);
    if (Number.isNaN(hour) || Number.isNaN(min) || min > 59) return;
    if (is12) {
      if (hour < 1 || hour > 12) return;
      hour = hour % 12 + (per === 'pm' ? 12 : 0);
    } else if (hour > 23) return;
    onCommit(`${pad2(hour)}:${pad2(min)}`);
  }

  function setFocus(v: boolean) {
    focused.current = v;
    onFocusChange?.(v);
  }

  function isValidHour(n: number) {
    return is12 ? n >= 1 && n <= 12 : n >= 0 && n <= 23;
  }

  function onHours(raw: string) {
    let digits = raw.replace(/\D/g, '');
    // Primera tecla tras enfocar: empezar de cero con el dígito recién escrito.
    if (fresh.current) digits = digits.slice(-1);
    fresh.current = false;
    let d = digits.slice(0, 2);
    // Si hay 2 dígitos pero no forman una hora válida (ej. "93"), conservar solo
    // el primero. Nunca saltamos por esto.
    if (d.length === 2 && !isValidHour(parseInt(d, 10))) d = d[0];
    setH(d);
    const complete = d.length === 2 && isValidHour(parseInt(d, 10));
    if (complete) {
      mRef.current?.focus(); // avanzar SOLO con la hora completa (2 dígitos)
    }
    if (m && d) buildAndCommit(d, m, period);
  }

  function onMinutes(raw: string) {
    let digits = raw.replace(/\D/g, '');
    if (fresh.current) digits = digits.slice(-1);
    fresh.current = false;
    let d = digits.slice(0, 2);
    // Si el primer dígito es > 5, no puede ser decena → interpretar como 0X
    if (d.length === 1 && parseInt(d, 10) > 5) d = '0' + d;
    setM(d);
    // Comprometer solo con el minuto completo (2 dígitos); el dígito suelto se
    // normaliza al salir del campo (onBlur) para no emitir valores intermedios.
    if (h && d.length === 2) buildAndCommit(h, d, period);
  }

  function onMinutesKey(e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && m === '') { e.preventDefault(); hRef.current?.focus(); }
  }

  function togglePeriod() {
    const next = period === 'am' ? 'pm' : 'am';
    setPeriod(next);
    if (h && m) buildAndCommit(h, m, next);
  }

  function normalizeOnBlur() {
    setFocus(false);
    if (h && m) {
      const hh = pad2(parseInt(h, 10));
      const mm = pad2(parseInt(m, 10));
      setH(is12 ? String(parseInt(h, 10)) : hh);
      setM(mm);
      buildAndCommit(h, mm, period);
    }
  }

  const boxBase = `text-center text-lg font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500
    ${theme === 'dark' ? 'bg-white/10 text-white border border-white/15' : 'bg-white text-gray-800 border border-gray-200'}
    ${invalid ? 'border-red-400 ring-1 ring-red-400' : ''}`;
  const labelCls = 'text-[10px] font-bold uppercase mb-1';

  return (
    <div className="flex items-end justify-center gap-2">
      <div className="flex flex-col items-center">
        <span className={labelCls} style={{ color: t.wheelColLabel }}>Hora</span>
        <input
          ref={hRef}
          type="text"
          inputMode="numeric"
          value={h}
          placeholder={is12 ? '12' : '00'}
          aria-label="Hora"
          onFocus={e => { setFocus(true); fresh.current = true; e.currentTarget.select(); }}
          onMouseUp={e => e.preventDefault()}
          onBlur={normalizeOnBlur}
          onChange={e => onHours(e.target.value)}
          className={`${boxBase} w-14 py-2`}
        />
      </div>

      <span className="font-bold text-lg pb-2" style={{ color: t.wheelColLabel }}>:</span>

      <div className="flex flex-col items-center">
        <span className={labelCls} style={{ color: t.wheelColLabel }}>Min</span>
        <input
          ref={mRef}
          type="text"
          inputMode="numeric"
          value={m}
          placeholder="00"
          aria-label="Minutos"
          onFocus={e => { setFocus(true); fresh.current = true; e.currentTarget.select(); }}
          onMouseUp={e => e.preventDefault()}
          onBlur={normalizeOnBlur}
          onChange={e => onMinutes(e.target.value)}
          onKeyDown={onMinutesKey}
          className={`${boxBase} w-14 py-2`}
        />
      </div>

      {is12 && (
        <div className="flex flex-col items-center">
          <span className={labelCls} style={{ color: t.wheelColLabel }}>Período</span>
          <button
            type="button"
            onClick={togglePeriod}
            aria-label={`Cambiar a ${period === 'am' ? 'p.m.' : 'a.m.'}`}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500
              ${theme === 'dark' ? 'bg-white/10 text-white border border-white/15' : 'bg-white text-gray-800 border border-gray-200'}`}
          >
            {period === 'am' ? 'a.m.' : 'p.m.'}
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>
        </div>
      )}
    </div>
  );
}
