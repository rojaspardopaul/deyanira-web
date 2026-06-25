'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Trash2, Loader2, Search, User, CalendarClock, Check, Link2, Sparkles } from 'lucide-react';
import DateTimePicker from '@/components/ui/datetime';
import { adminApi } from '@/lib/api';
import type { Receipt, CustomerBooking } from '@/features/receipts/api/receipts.api';
import { METHODS, METHOD_LABEL, RESERVA_STATUS, money, fmtDate } from './labels';
import BookingPickerModal from './BookingPickerModal';

export interface ReceiptPrefill {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  title?: string;
  items?: { description: string; amountPen: number }[];
  bookingGroupId?: string | null;
  packageId?: string | null;
}

type Line = { description: string; amount: string };
type Customer = { id: string; name: string; phone?: string | null; email?: string | null };

const linesFrom = (items?: { description: string; amountPen: number }[]): Line[] =>
  items?.length ? items.map((it) => ({ description: it.description, amount: String(it.amountPen) })) : [{ description: '', amount: '' }];

type Metodo = (typeof METHODS)[number];
type PayRow = { amount: string; method: Metodo; date: string | null; note: string; existing: boolean };
const todayYMD = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
const asMetodo = (m: string | null | undefined): Metodo => ((METHODS as readonly string[]).includes(m || '') ? (m as Metodo) : 'cash');
const emptyPay = (): PayRow => ({ amount: '', method: 'cash', date: todayYMD(), note: '', existing: false });
function paymentsFor(total: number, isPackage: boolean): PayRow[] {
  if (total > 0) {
    const amt = isPackage ? Math.round(total * 0.5 * 100) / 100 : total;
    return [{ amount: String(amt), method: 'cash', date: todayYMD(), note: isPackage ? 'Adelanto (50%)' : 'Pago completo', existing: false }];
  }
  return [emptyPay()];
}

export default function NewReceiptModal({
  open,
  onClose,
  onCreated,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (r: Receipt) => void;
  prefill?: ReceiptPrefill;
}) {
  const [name, setName] = useState(prefill?.customerName ?? '');
  const [phone, setPhone] = useState(prefill?.customerPhone ?? '');
  const [emailAddr, setEmailAddr] = useState(prefill?.customerEmail ?? '');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [title, setTitle] = useState(prefill?.title ?? '');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>(linesFrom(prefill?.items));

  // Vínculo a reserva
  const [bookingGroupId, setBookingGroupId] = useState<string | null>(prefill?.bookingGroupId ?? null);
  const [packageId, setPackageId] = useState<string | null>(prefill?.packageId ?? null);
  const [selectedBooking, setSelectedBooking] = useState<string | null>(prefill?.bookingGroupId ?? null);

  // Búsqueda de cliente
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justSelected = useRef(false);

  // Reservas del cliente
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Pagos a registrar al crear (obligatorio ≥ 1). Se prellenan según la reserva.
  const [payments, setPayments] = useState<PayRow[]>(
    paymentsFor((prefill?.items || []).reduce((s, it) => s + it.amountPen, 0), !!prefill?.packageId),
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const total = useMemo(() => lines.reduce((s, l) => s + (Number(l.amount) || 0), 0), [lines]);
  const paidSum = useMemo(() => payments.reduce((s, p) => s + (Number(p.amount) || 0), 0), [payments]);
  const saldo = Math.round((total - paidSum) * 100) / 100;
  const selBooking = useMemo(
    () => bookings.find((b) => b.bookingGroupId === selectedBooking) || null,
    [bookings, selectedBooking],
  );

  // ── Autocompletar cliente ──────────────────────────────────────────────────
  useEffect(() => {
    if (justSelected.current) { justSelected.current = false; return; }
    if (!name.trim() || name.trim().length < 2) { setResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await adminApi().customers.search(name.trim()) as Customer[];
        setResults(data.slice(0, 8));
        setShowResults(true);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [name]);

  // ── Cargar reservas al seleccionar/identificar cliente ─────────────────────
  useEffect(() => {
    if (!customerId && !phone.trim()) { setBookings([]); return; }
    let cancelled = false;
    setLoadingBookings(true);
    adminApi().receipts.customerBookings({ customerId, phone: phone.trim() || null })
      .then((data) => { if (!cancelled) setBookings(data); })
      .catch(() => { if (!cancelled) setBookings([]); })
      .finally(() => { if (!cancelled) setLoadingBookings(false); });
    return () => { cancelled = true; };
  }, [customerId, phone]);

  if (!open) return null;

  function pickCustomer(c: Customer) {
    justSelected.current = true;
    setName(c.name);
    setPhone(c.phone || '');
    setEmailAddr(c.email || '');
    setCustomerId(c.id);
    setResults([]);
    setShowResults(false);
  }

  function pickBooking(b: CustomerBooking | null) {
    if (!b) {
      // Cobro libre (sin reserva)
      setSelectedBooking('free');
      setBookingGroupId(null);
      setPackageId(null);
      setPayments([emptyPay()]);
      return;
    }
    setSelectedBooking(b.bookingGroupId);
    setBookingGroupId(b.bookingGroupId);
    setPackageId(b.packageId);
    setTitle(b.label);
    setLines(linesFrom(b.items));

    const dep = b.deposit;
    const paid = dep?.paidPen || 0;
    const half = Math.round(b.total * 0.5 * 100) / 100; // los paquetes suelen ser 50%
    if (paid > 0) {
      // Ya hay un pago previo → informativo (no editable), con su método y fecha.
      setPayments([{
        amount: String(paid),
        method: asMetodo(dep?.method),
        date: dep?.paidAt ? dep.paidAt.slice(0, 10) : todayYMD(),
        note: dep?.receiptNumber ? `Pago previo · ${dep.receiptNumber}` : 'Pago previo',
        existing: true,
      }]);
    } else if (b.isPackage) {
      // Paquete → adelanto, generalmente 50% (depositPen suele ser el 50%).
      const sugerido = dep && dep.depositPen > 0 ? dep.depositPen : half;
      setPayments([{ amount: String(sugerido), method: 'cash', date: todayYMD(), note: 'Adelanto (50%)', existing: false }]);
    } else {
      // Servicio normal → se paga el 100%.
      setPayments([{ amount: String(b.total), method: 'cash', date: todayYMD(), note: 'Pago completo', existing: false }]);
    }
  }

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { description: '', amount: '' }]);
  const removeLine = (i: number) => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));

  const setPay = (i: number, patch: Partial<PayRow>) =>
    setPayments((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  // Al agregar otro pago: autocompleta el saldo restante (editable) y la fecha de hoy.
  const addPay = () =>
    setPayments((ps) => {
      const sum = ps.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const remaining = Math.max(0, Math.round((total - sum) * 100) / 100);
      return [...ps, { amount: remaining > 0 ? String(remaining) : '', method: 'cash', date: todayYMD(), note: '', existing: false }];
    });
  const removePay = (i: number) => setPayments((ps) => (ps.length > 1 ? ps.filter((_, idx) => idx !== i) : ps));

  async function submit() {
    setError('');
    const cleanName = name.trim();
    if (!cleanName) { setError('El nombre del cliente es obligatorio'); return; }
    const items = lines
      .map((l) => ({ description: l.description.trim(), amount: Number(l.amount) || 0 }))
      .filter((l) => l.description && l.amount > 0)
      .map((l) => ({ description: l.description, qty: 1, unitPen: l.amount, amountPen: l.amount }));
    if (items.length === 0) { setError('Agrega al menos un concepto con monto'); return; }

    const totalItems = items.reduce((s, it) => s + it.amountPen, 0);
    const pays = payments
      .map((p) => ({ amountPen: Number(p.amount) || 0, method: p.method, paidAt: p.date, note: p.note.trim() || null }))
      .filter((p) => p.amountPen > 0);
    if (pays.length === 0) { setError('Registra al menos un pago'); return; }
    const sumPays = Math.round(pays.reduce((s, p) => s + p.amountPen, 0) * 100) / 100;
    if (sumPays > totalItems + 0.001) { setError('Los pagos superan el total del recibo'); return; }

    setSaving(true);
    try {
      // Si no se eligió un cliente existente, crearlo automáticamente.
      let cid = customerId;
      if (!cid) {
        try {
          const created = await adminApi().customers.create({
            name: cleanName,
            phone: phone.trim() || undefined,
            email: emailAddr.trim() || undefined,
          }) as { id?: string };
          cid = created?.id ?? null;
        } catch { /* si falla la creación del cliente, igual creamos el recibo */ }
      }

      const recibo = await adminApi().receipts.create({
        customerId: cid,
        customerName: cleanName,
        customerPhone: phone.trim() || null,
        customerEmail: emailAddr.trim() || null,
        title: title.trim() || null,
        items,
        notes: notes.trim() || null,
        bookingGroupId,
        packageId,
        payments: pays,
      });
      onCreated(recibo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el recibo');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4 rounded-t-3xl">
          <h2 className="font-display font-bold text-lg text-gray-900">Nuevo recibo</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Cliente con autocompletado */}
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Cliente *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className={inputCls + ' pl-9'}
                value={name}
                onChange={(e) => { setName(e.target.value); setCustomerId(null); }}
                onFocus={() => results.length && setShowResults(true)}
                placeholder="Buscar o escribir nombre…"
                autoComplete="off"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-300" />}
              {customerId && !searching && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />}
            </div>
            {showResults && results.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                {results.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => pickCustomer(c)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-pink-50"
                  >
                    <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="font-medium text-gray-800">{c.name}</span>
                    {c.phone && <span className="text-gray-400 text-xs">· {c.phone}</span>}
                  </button>
                ))}
              </div>
            )}
            {!customerId && name.trim().length >= 2 && !searching && (
              <p className="text-[11px] text-gray-400 mt-1">Si no existe, se creará un cliente nuevo al guardar.</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Teléfono</label>
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="999 999 999" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Correo</label>
              <input className={inputCls} value={emailAddr} onChange={(e) => setEmailAddr(e.target.value)} placeholder="cliente@correo.com" />
            </div>
          </div>

          {/* Reserva vinculada — se elige en un popup */}
          {(customerId || phone.trim()) && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Reserva vinculada</label>
              {loadingBookings ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-1"><Loader2 className="w-4 h-4 animate-spin" /> Buscando reservas…</div>
              ) : selectedBooking && selectedBooking !== 'free' ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-pink-200 bg-pink-50/50 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 min-w-0">
                      {selBooking?.isPackage ? <Sparkles className="w-3.5 h-3.5 text-pink-400 shrink-0" /> : <CalendarClock className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                      <span className="truncate">{selBooking?.label || 'Reserva vinculada'}</span>
                    </div>
                    {selBooking && (
                      <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                        <span className={`font-bold px-1.5 py-0.5 rounded-full ${RESERVA_STATUS[selBooking.status]?.cls || 'bg-gray-100 text-gray-500'}`}>{RESERVA_STATUS[selBooking.status]?.label || selBooking.status}</span>
                        <span className="text-gray-400">{money(selBooking.total)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {bookings.length > 0 && <button onClick={() => setShowPicker(true)} className="text-xs font-semibold text-pink-600 hover:text-pink-700 px-1.5 py-1">Cambiar</button>}
                    <button onClick={() => pickBooking(null)} className="p-1 text-gray-400 hover:text-red-500 rounded" title="Quitar vínculo"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ) : bookings.length > 0 ? (
                <button onClick={() => setShowPicker(true)} className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-2.5 text-sm font-semibold text-gray-600 hover:border-pink-300 hover:text-pink-600">
                  <Link2 className="w-4 h-4" /> Elegir una reserva ({bookings.length})
                </button>
              ) : (
                <p className="text-xs text-gray-400">Sin reservas activas — cobro libre.</p>
              )}
            </div>
          )}

          {/* Recibo en edición — se llena como si fuera escrito a mano */}
          <div className="rounded-2xl border border-gray-200 overflow-hidden" style={{ borderTop: '3px solid #d4af37' }}>
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/70 border-b border-gray-100">
              <span className="font-display font-bold text-sm tracking-[0.2em] text-gray-700">RECIBO</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400">N.º al guardar</span>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm"><span className="text-gray-400">Cliente: </span><span className="font-semibold text-gray-800">{name.trim() || '—'}</span></p>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">Concepto</label>
                <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Paquete Novia, Sesión de fotos…" />
              </div>

              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <span>Descripción{bookingGroupId ? ' · de la reserva' : ''}</span><span>Importe</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {lines.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1">
                      <input className="flex-1 bg-transparent px-1 py-1.5 text-sm focus:outline-none" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Descripción…" />
                      <div className="relative w-24 shrink-0">
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">S/</span>
                        <input className="w-full bg-transparent pl-6 pr-1 py-1.5 text-sm text-right focus:outline-none" value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value.replace(/[^0-9.]/g, '') })} inputMode="decimal" placeholder="0.00" />
                      </div>
                      <button onClick={() => removeLine(i)} className="p-1 text-gray-300 hover:text-red-500 shrink-0" title="Quitar"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
                <button onClick={addLine} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-pink-600 hover:bg-pink-50 border-t border-gray-100"><Plus className="w-3.5 h-3.5" /> Agregar línea</button>
              </div>

              <div className="flex items-center justify-between border-t-2 border-gray-200 pt-2.5">
                <span className="text-sm font-bold text-gray-700">Total</span>
                <span className="font-display font-bold text-xl text-gray-900">{money(total)}</span>
              </div>
            </div>
          </div>

          {/* Pagos (obligatorio ≥ 1) — adelanto / abonos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-500">Pagos</label>
              <span className="text-[11px] text-gray-400">
                Saldo: <span className={saldo > 0 ? 'text-amber-600 font-semibold' : 'text-green-600 font-semibold'}>{money(Math.max(0, saldo))}</span>
              </span>
            </div>

            {payments.map((p, i) => (
              p.existing ? (
                // Pago ya registrado: solo informativo (no editable).
                <div key={i} className="rounded-xl border border-green-200 bg-green-50/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-green-700">Pago ya registrado</span>
                    <span className="text-sm font-bold text-gray-900">{money(Number(p.amount) || 0)}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {METHOD_LABEL[p.method] || p.method}{p.date ? ` · ${fmtDate(p.date)}` : ''}{p.note ? ` · ${p.note}` : ''}
                  </p>
                </div>
              ) : (
                <div key={i} className="rounded-xl border border-gray-200 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600">Pago {i + 1}</span>
                    {payments.length > 1 && (
                      <button onClick={() => removePay(i)} className="p-1 text-gray-300 hover:text-red-500" title="Quitar pago"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 mb-1">Monto</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">S/</span>
                        <input className={inputCls + ' pl-7 text-right'} value={p.amount} onChange={(e) => setPay(i, { amount: e.target.value.replace(/[^0-9.]/g, '') })} inputMode="decimal" placeholder="0.00" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 mb-1">Método</label>
                      <select className={inputCls} value={p.method} onChange={(e) => setPay(i, { method: e.target.value as Metodo })}>
                        {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Fecha en su propia fila (ancho completo para que no se recorte el calendario) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1">Fecha</label>
                    <DateTimePicker mode="date" value={p.date} onChange={(v) => setPay(i, { date: v as string | null })} />
                  </div>
                  <input className={inputCls} value={p.note} onChange={(e) => setPay(i, { note: e.target.value })} placeholder="Nota del pago (opcional)" />
                </div>
              )
            ))}

            {saldo > 0 && (
              <button onClick={addPay} className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-2 text-sm font-semibold text-pink-600 hover:border-pink-300">
                <Plus className="w-4 h-4" /> Agregar otro pago (resto o parcial)
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Notas (opcional)</label>
            <textarea className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas internas…" />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-gray-100 bg-white px-5 py-3 rounded-b-3xl">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancelar</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white bg-pink-600 hover:bg-pink-500 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Crear recibo
          </button>
        </div>
      </div>

      {showPicker && (
        <BookingPickerModal
          bookings={bookings}
          selectedId={selectedBooking && selectedBooking !== 'free' ? selectedBooking : null}
          onSelect={(b) => pickBooking(b)}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
