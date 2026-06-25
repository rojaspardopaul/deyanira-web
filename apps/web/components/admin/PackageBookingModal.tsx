'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi, api } from '@/lib/api';
import { X, Search, UserCheck, Loader2, CheckCircle2, Package, Upload } from 'lucide-react';
import DateTimePicker from '@/components/ui/datetime';

type Obj = Record<string, unknown>;
const money = (n: number) => `S/ ${Number(n || 0).toFixed(2)}`;

type TrialAddon = { serviceId: string; name: string; duration: number; extraPricePen: number; daysBeforeMain: number };
type PackageDetail = {
  id: string; name: string; pricePen: number;
  requiresDeposit?: boolean; depositPercent?: number;
  items: Array<{ id: string; label: string; serviceId: string | null; duration?: number }>;
  trialAddon?: TrialAddon | null;
};

export default function PackageBookingModal({ token, onClose, onCreated }: {
  token: string; onClose: () => void; onCreated: (receiptNumber: string | null, bookingPaymentId: string | null) => void;
}) {
  const today = new Date().toISOString().split('T')[0];

  const [eventTypes, setEventTypes] = useState<Obj[]>([]);
  const [packages, setPackages] = useState<Obj[]>([]);
  const [allStaff, setAllStaff] = useState<Obj[]>([]);
  const [eventTypeId, setEventTypeId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [pkg, setPkg] = useState<PackageDetail | null>(null);
  const [loadingPkg, setLoadingPkg] = useState(false);

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [staffId, setStaffId] = useState(''); // '' = on-duty (turno)

  // Servicio adicional del paquete (prueba): opcional y en OTRA fecha (anticipada).
  const [includeTrial, setIncludeTrial] = useState(false);
  const [trialDate, setTrialDate] = useState('');
  const [trialTime, setTrialTime] = useState('10:00');

  const [recordDeposit, setRecordDeposit] = useState(true);
  const [depositPaidPen, setDepositPaidPen] = useState('');
  const [method, setMethod] = useState('cash');
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Customer search
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<Obj[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const a = adminApi(token);
    Promise.all([api.eventTypes.list(), a.staff.list()])
      .then(([ets, staff]) => { setEventTypes(ets as Obj[]); setAllStaff(staff as Obj[]); })
      .catch(() => {});
  }, [token]);

  // Cargar paquetes del evento elegido
  useEffect(() => {
    if (!eventTypeId) { setPackages([]); return; }
    adminApi(token).packages.list(eventTypeId).then((p) => setPackages(p as Obj[])).catch(() => setPackages([]));
  }, [eventTypeId, token]);

  // Cargar detalle del paquete (items + adelanto). Al cambiar de paquete se
  // resetea el servicio adicional.
  useEffect(() => {
    setIncludeTrial(false); setTrialDate('');
    if (!packageId) { setPkg(null); return; }
    setLoadingPkg(true);
    api.eventTypes.package(packageId)
      .then((p) => setPkg(p as PackageDetail))
      .catch(() => setPkg(null))
      .finally(() => setLoadingPkg(false));
  }, [packageId]);

  const trial = pkg?.trialAddon || null;
  const trialExtra = includeTrial && trial ? Number(trial.extraPricePen) || 0 : 0;
  const total = (pkg ? Number(pkg.pricePen) : 0) + trialExtra;
  const depositPercent = pkg?.depositPercent ?? 50;
  const depositPen = useMemo(() => (pkg?.requiresDeposit ? Math.round(total * depositPercent) / 100 : 0), [pkg, total, depositPercent]);
  const bookableItems = useMemo(() => (pkg?.items || []).filter((it) => it.serviceId), [pkg]);

  // La prueba debe agendarse al menos `daysBeforeMain` días antes del día central.
  const maxTrialDate = useMemo(() => {
    if (!date || !trial) return undefined;
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - (trial.daysBeforeMain || 0));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [date, trial]);
  const trialTooSoon = !!(maxTrialDate && maxTrialDate < today);

  function searchCustomers(q: string) {
    setCustomerQuery(q); setSelectedCustomerId(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setCustomerResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try { setCustomerResults(await adminApi(token).customers.search(q) as Obj[]); }
      catch { setCustomerResults([]); }
    }, 300);
  }
  function selectCustomer(c: Obj) {
    setSelectedCustomerId(c.id as string);
    setGuestName((c.fullName || c.name || '') as string);
    setGuestPhone((c.phone || '') as string);
    setGuestEmail((c.email || '') as string);
    setCustomerQuery(''); setCustomerResults([]);
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setError('La imagen no debe superar 8MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setProofPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function submit() {
    setError('');
    if (!pkg) { setError('Selecciona un paquete'); return; }
    if (bookableItems.length === 0) { setError('Este paquete no tiene servicios reservables'); return; }
    if (!guestName.trim()) { setError('Ingresa el nombre del cliente'); return; }
    if (!date) { setError('Selecciona la fecha'); return; }
    if (includeTrial && trial) {
      if (trialTooSoon) { setError(`El día central es muy próximo: la prueba necesita ${trial.daysBeforeMain} días de anticipación`); return; }
      if (!trialDate) { setError('Selecciona la fecha de la prueba (servicio adicional)'); return; }
    }

    setCreating(true);
    try {
      // Sube el comprobante (opcional) y obtén su URL
      let proofImageUrl: string | undefined;
      if (recordDeposit && proofPreview) {
        const up = await adminApi(token).upload(proofPreview, 'general') as { url?: string };
        proofImageUrl = up?.url;
      }
      type Item = { serviceId: string | null; staffId: string | null; onDuty: boolean; date?: string; startTime?: string; addonPricePen?: number };
      const items: Item[] = bookableItems.map((it) => ({
        serviceId: it.serviceId,
        staffId: staffId || null,
        onDuty: !staffId,
      }));
      // Servicio adicional (prueba): su propia fecha/hora y su precio extra.
      if (includeTrial && trial) {
        items.push({
          serviceId: trial.serviceId,
          staffId: staffId || null,
          onDuty: !staffId,
          date: trialDate,
          startTime: trialTime,
          addonPricePen: Number(trial.extraPricePen) || 0,
        });
      }
      const res = await adminApi(token).appointments.createPackage({
        packageId: pkg.id,
        items,
        date,
        startTime,
        guestName: guestName.trim(),
        guestPhone: guestPhone || undefined,
        guestEmail: guestEmail || undefined,
        customerId: selectedCustomerId || undefined,
        recordDeposit,
        depositPaidPen: recordDeposit ? (depositPaidPen ? Number(depositPaidPen) : depositPen) : undefined,
        method: recordDeposit ? method : undefined,
        proofImageUrl,
      });
      onCreated(res.receiptNumber, res.bookingPaymentId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la reserva');
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-lg text-gray-900 flex items-center gap-2"><Package className="w-5 h-5 text-pink-500" /> Nueva reserva de paquete</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Cliente */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Buscar cliente existente</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={customerQuery} onChange={(e) => searchCustomers(e.target.value)} placeholder="Nombre, teléfono o email..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400" />
            </div>
            {customerResults.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden shadow-lg bg-white max-h-40 overflow-y-auto">
                {customerResults.map((c) => (
                  <button key={c.id as string} type="button" onClick={() => selectCustomer(c)}
                    className="w-full text-left px-3 py-2.5 hover:bg-pink-50 border-b border-gray-100 last:border-0">
                    <p className="text-sm font-medium text-gray-900">{(c.fullName || c.name) as string}</p>
                    <p className="text-xs text-gray-500">{c.phone as string} · {c.email as string}</p>
                  </button>
                ))}
              </div>
            )}
            {selectedCustomerId && (
              <div className="mt-1.5 flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                <UserCheck className="w-3.5 h-3.5" /> Cliente seleccionado
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nombre *</label>
              <input value={guestName} onChange={(e) => setGuestName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Teléfono</label>
              <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Email (para recibo)</label>
            <input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400" />
          </div>

          {/* Evento + paquete */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Evento *</label>
              <select value={eventTypeId} onChange={(e) => { setEventTypeId(e.target.value); setPackageId(''); setPkg(null); }} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400">
                <option value="">Seleccionar...</option>
                {eventTypes.map((et) => <option key={et.id as string} value={et.id as string}>{et.name as string}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Paquete *</label>
              <select value={packageId} onChange={(e) => setPackageId(e.target.value)} disabled={!eventTypeId} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 disabled:bg-gray-50">
                <option value="">Seleccionar...</option>
                {packages.map((p) => <option key={p.id as string} value={p.id as string}>{p.name as string} — {money(Number(p.pricePen))}</option>)}
              </select>
            </div>
          </div>

          {loadingPkg && <p className="text-xs text-gray-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando paquete...</p>}

          {pkg && (
            <div className="rounded-xl bg-gray-50 p-3 border border-gray-100">
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Incluye ({bookableItems.length} servicio(s) reservable(s)):</p>
              <ul className="text-xs text-gray-500 space-y-0.5">
                {pkg.items.map((it) => (
                  <li key={it.id} className={it.serviceId ? '' : 'opacity-50'}>◆ {it.label}{!it.serviceId && ' (sin agenda)'}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Estilista + fecha + hora */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Estilista (aplica a todo el paquete)</label>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400">
              <option value="">Estilista de turno (asignar luego)</option>
              {allStaff.filter((s) => s.isActive).map((s) => <option key={s.id as string} value={s.id as string}>{s.name as string}</option>)}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">Elige una estilista para validar que no se cruce con otras citas.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">Fecha y hora de inicio *</label>
            <DateTimePicker
              mode="datetime"
              variant="inline"
              theme="light"
              minDate={today}
              minuteStep={15}
              value={{ date, startTime }}
              onChange={(v) => { setDate(v.date); setStartTime(v.startTime); }}
            />
          </div>

          {/* Servicio adicional (prueba) — opcional, en otra fecha (anticipada) */}
          {trial && (
            <div className="rounded-xl border border-gray-200 p-3">
              <label className="flex items-start gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
                <input type="checkbox" checked={includeTrial} onChange={(e) => setIncludeTrial(e.target.checked)} className="rounded mt-0.5" />
                <span>
                  Incluir &ldquo;{trial.name}&rdquo; <span className="text-pink-600">(+{money(trial.extraPricePen)})</span>
                  <span className="block text-[11px] font-normal text-gray-400 mt-0.5">
                    Servicio adicional · se agenda en <strong>otra fecha</strong>, al menos {trial.daysBeforeMain} días antes del día central.
                  </span>
                </span>
              </label>
              {includeTrial && (
                <div className="mt-3">
                  {!date ? (
                    <p className="text-[11px] text-amber-600">Elige primero la fecha del día central (arriba).</p>
                  ) : trialTooSoon ? (
                    <p className="text-[11px] text-amber-600">El día central es muy próximo: la prueba necesita {trial.daysBeforeMain} días de anticipación. Elige una fecha central más lejana.</p>
                  ) : (
                    <>
                      <label className="block text-xs font-semibold text-gray-500 mb-2">Fecha y hora de la prueba *</label>
                      <DateTimePicker
                        mode="datetime"
                        variant="inline"
                        theme="light"
                        minDate={today}
                        maxDate={maxTrialDate}
                        minuteStep={15}
                        value={{ date: trialDate, startTime: trialTime }}
                        onChange={(v) => { setTrialDate(v.date); setTrialTime(v.startTime); }}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Adelanto */}
          {pkg && (
            <div className="rounded-xl border border-pink-100 bg-pink-50/50 p-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <input type="checkbox" checked={recordDeposit} onChange={(e) => setRecordDeposit(e.target.checked)} className="rounded" />
                Registrar adelanto pagado
              </label>
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>Total: <strong className="text-gray-800">{money(total)}</strong></span>
                <span>Adelanto sugerido ({depositPercent}%): <strong className="text-pink-600">{money(depositPen)}</strong></span>
              </div>
              {recordDeposit && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Monto recibido</label>
                    <input type="number" value={depositPaidPen} onChange={(e) => setDepositPaidPen(e.target.value)} placeholder={String(depositPen)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Método</label>
                    <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm">
                      <option value="cash">Efectivo</option>
                      <option value="yape">Yape</option>
                      <option value="plin">Plin</option>
                      <option value="transfer">Transferencia</option>
                      <option value="culqi">Tarjeta</option>
                    </select>
                  </div>
                </div>
              )}
              {recordDeposit && (
                <>
                  <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
                  <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 text-xs inline-flex items-center gap-1.5 text-pink-600 font-semibold">
                    <Upload className="w-3.5 h-3.5" /> {proofPreview ? 'Comprobante adjunto' : 'Adjuntar comprobante (opcional)'}
                  </button>
                </>
              )}
            </div>
          )}

          {error && <p className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl">Cancelar</button>
          <button onClick={submit} disabled={creating || !pkg || !guestName || !date || (includeTrial && (!trialDate || trialTooSoon))}
            className="px-5 py-2 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm inline-flex items-center gap-2">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {creating ? 'Creando...' : 'Crear reserva'}
          </button>
        </div>
      </div>
    </div>
  );
}
