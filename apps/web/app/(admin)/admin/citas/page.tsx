'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, api } from '@/lib/api';
import Link from 'next/link';
import { ChevronLeft, Calendar, Clock, Check, X, Plus, Search, UserCheck, Package } from 'lucide-react';
import { ConfirmModal, type ConfirmDialogConfig } from '@/components/ui/ConfirmModal';
import DateTimePicker from '@/components/ui/datetime';
import PackageBookingModal from '@/components/admin/PackageBookingModal';
import { confirmAction } from '@/lib/confirm';
import { HL, New, Danger } from '@/components/ui/highlight';
import { fmtTime12 } from '@/lib/time';

const STATUS_MAP = {
  pending:   { label: 'Pendiente',  color: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmada', color: 'bg-green-100 text-green-700' },
  completed: { label: 'Completada', color: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Cancelada',  color: 'bg-red-100 text-red-500' },
  no_show:   { label: 'No asistió', color: 'bg-gray-100 text-gray-500' },
};

type Apt = Record<string, unknown>;
type PeriodMode = 'day' | 'week' | 'month' | 'custom';

const EMPTY_FORM = {
  guestName: '', guestPhone: '', serviceId: '',
  staffId: '', date: '', startTime: '', endTime: '', notes: '',
};

function toISO(d: Date) {
  return d.toISOString().split('T')[0];
}
function getWeekRange() {
  const ref = new Date();
  const day = ref.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(ref); mon.setDate(ref.getDate() + diff);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { from: toISO(mon), to: toISO(sun) };
}
function getMonthRange() {
  const ref = new Date();
  return {
    from: toISO(new Date(ref.getFullYear(), ref.getMonth(), 1)),
    to: toISO(new Date(ref.getFullYear(), ref.getMonth() + 1, 0)),
  };
}

export default function AdminCitasPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Apt[]>([]);
  const [loading, setLoading] = useState(true);

  // Period filter
  const [periodMode, setPeriodMode] = useState<PeriodMode>('day');
  const [singleDate, setSingleDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [statusFilter, setStatusFilter] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig | null>(null);

  // New appointment state
  const [showNew, setShowNew] = useState(false);
  const [showPackage, setShowPackage] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [services, setServices] = useState<Apt[]>([]);
  const [allStaff, setAllStaff] = useState<Apt[]>([]);
  const [slots, setSlots] = useState<{ start: string; end: string }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Customer search
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<Apt[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Apt | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (token: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (periodMode === 'day') {
      if (singleDate) params.set('date', singleDate);
    } else if (periodMode === 'week') {
      const { from, to } = getWeekRange();
      params.set('dateFrom', from);
      params.set('dateTo', to);
    } else if (periodMode === 'month') {
      const { from, to } = getMonthRange();
      params.set('dateFrom', from);
      params.set('dateTo', to);
    } else if (periodMode === 'custom') {
      if (customFrom) params.set('dateFrom', customFrom);
      if (customTo) params.set('dateTo', customTo);
    }
    if (statusFilter) params.set('status', statusFilter);

    const data = await adminApi(token).appointments.list(params.toString()).catch((err: Error) => {
      if (err.message.toLowerCase().includes('401') || err.message.toLowerCase().includes('token')) {
        localStorage.removeItem('admin_token');
        router.push('/admin/login');
      }
      return [];
    });
    setAppointments(data as Apt[]);
    setLoading(false);
  }, [periodMode, singleDate, customFrom, customTo, statusFilter, router]);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { router.push('/admin/login'); return; }
    load(token);
  }, [router, load]);

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!clientSearch.trim()) return appointments;
    const q = clientSearch.toLowerCase();
    return appointments.filter(a => {
      const name = ((a.guestName || (a.customer as Record<string, unknown>)?.name || '') as string).toLowerCase();
      const phone = (a.guestPhone || (a.customer as Record<string, unknown>)?.phone || '') as string;
      return name.includes(q) || phone.includes(q);
    });
  }, [appointments, clientSearch]);

  // Load services and staff when modal opens
  useEffect(() => {
    if (!showNew) return;
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    const a = adminApi(token);
    Promise.all([a.services.list(), a.staff.list()]).then(([svcs, staff]) => {
      setServices(svcs as Apt[]);
      setAllStaff(staff as Apt[]);
    }).catch(console.error);
  }, [showNew]);

  function searchCustomers(q: string) {
    setCustomerQuery(q);
    setSelectedCustomer(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setCustomerResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const token = localStorage.getItem('admin_token');
      if (!token) return;
      setCustomerSearching(true);
      try {
        const results = await adminApi(token).customers.search(q);
        setCustomerResults(results as Apt[]);
      } catch { setCustomerResults([]); }
      finally { setCustomerSearching(false); }
    }, 300);
  }

  function selectCustomer(c: Apt) {
    setSelectedCustomer(c);
    setNewForm(f => ({
      ...f,
      guestName: (c.fullName || c.name || '') as string,
      guestPhone: (c.phone || '') as string,
    }));
    setCustomerQuery('');
    setCustomerResults([]);
  }

  useEffect(() => {
    if (!newForm.serviceId || !newForm.staffId || !newForm.date) { setSlots([]); return; }
    setSlotsLoading(true);
    setSlots([]);
    api.appointments.availability(newForm.staffId, newForm.serviceId, newForm.date)
      .then(s => setSlots(s))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [newForm.serviceId, newForm.staffId, newForm.date]);

  const filteredStaff = newForm.serviceId
    ? allStaff.filter(s => {
        const ss = s.staffServices as Array<{ serviceId: string }>;
        return ss?.some(x => x.serviceId === newForm.serviceId);
      })
    : allStaff;

  async function doUpdateStatus(id: string, status: string) {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    setUpdating(id);
    try {
      await adminApi(token).appointments.update(id, { status });
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setUpdating(null);
    }
  }

  async function doUpdateGroupStatus(group: Apt[], status: string, groupKey: string) {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    setUpdating(groupKey);
    try {
      await Promise.all(group.map(a => adminApi(token).appointments.update(a.id as string, { status })));
      setAppointments(prev => prev.map(a =>
        group.some(g => g.id === a.id) ? { ...a, status } : a
      ));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al actualizar el grupo');
    } finally {
      setUpdating(null);
    }
  }

  function askStatus(apt: Apt, newStatus: string) {
    const name = (apt.guestName || (apt.customer as Record<string, unknown>)?.name || 'el cliente') as string;
    const time = apt.startTime as string;
    const cfg: Record<string, Omit<ConfirmDialogConfig, 'onConfirm'>> = {
      confirmed: { title: 'Confirmar cita', message: <>¿Confirmar la cita de <HL>{name}</HL> a las <New>{fmtTime12(time)}</New>?</>, confirmLabel: 'Sí, confirmar', confirmClass: 'bg-green-600 hover:bg-green-500' },
      completed: { title: 'Marcar como atendida', message: <>¿Marcar la cita de <HL>{name}</HL> (<HL>{fmtTime12(time)}</HL>) como <New>atendida</New>?</>, confirmLabel: 'Sí, completar', confirmClass: 'bg-blue-600 hover:bg-blue-500' },
      cancelled: { title: 'Cancelar cita', message: <>¿Cancelar la cita de <HL>{name}</HL> de las <HL>{fmtTime12(time)}</HL>? <Danger>No se puede deshacer.</Danger></>, confirmLabel: 'Sí, cancelar', confirmClass: 'bg-red-600 hover:bg-red-500' },
      no_show:   { title: 'No asistió', message: <>¿Marcar que <HL>{name}</HL> <Danger>no asistió</Danger> a su cita de las <HL>{fmtTime12(time)}</HL>?</>, confirmLabel: 'Sí, marcar', confirmClass: 'bg-gray-600 hover:bg-gray-500' },
    };
    const c = cfg[newStatus];
    if (!c) return;
    setConfirmDialog({ ...c, onConfirm: () => doUpdateStatus(apt.id as string, newStatus) });
  }

  function askGroupStatus(group: Apt[], newStatus: string, groupKey: string, pkgName: string) {
    const count = group.length;
    const cfg: Record<string, Omit<ConfirmDialogConfig, 'onConfirm'>> = {
      completed: { title: 'Completar paquete', message: <>¿Marcar los <HL>{count} servicios</HL> del paquete <HL>{pkgName}</HL> como <New>atendidos</New>?</>, confirmLabel: 'Sí, completar todo', confirmClass: 'bg-blue-600 hover:bg-blue-500' },
      cancelled: { title: 'Cancelar paquete', message: <>¿Cancelar los <HL>{count} servicios</HL> del paquete <HL>{pkgName}</HL>? <Danger>No se puede deshacer.</Danger></>, confirmLabel: 'Sí, cancelar todo', confirmClass: 'bg-red-600 hover:bg-red-500' },
      no_show:   { title: 'No asistió', message: <>¿Marcar que el cliente <Danger>no asistió</Danger> a los <HL>{count} servicios</HL> del paquete <HL>{pkgName}</HL>?</>, confirmLabel: 'Sí, marcar todo', confirmClass: 'bg-gray-600 hover:bg-gray-500' },
    };
    const c = cfg[newStatus];
    if (!c) return;
    setConfirmDialog({ ...c, onConfirm: () => doUpdateGroupStatus(group, newStatus, groupKey) });
  }

  async function createAppointment() {
    if (!newForm.guestName || !newForm.serviceId || !newForm.staffId || !newForm.date || !newForm.startTime) {
      alert('Completa todos los campos obligatorios');
      return;
    }
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    setCreating(true);
    try {
      await adminApi(token).appointments.create(newForm);
      setShowNew(false);
      setNewForm(EMPTY_FORM);
      load(token);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al crear la cita');
    } finally {
      setCreating(false);
    }
  }

  const today = new Date().toISOString().split('T')[0];

  const PERIOD_TABS: { key: PeriodMode; label: string }[] = [
    { key: 'day', label: 'Día' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
    { key: 'custom', label: 'Personalizado' },
  ];

  // Summary text shown under the tabs
  function periodSummary() {
    if (periodMode === 'day') {
      if (singleDate === today) return 'Hoy, ' + new Date(singleDate + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
      return new Date(singleDate + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (periodMode === 'week') {
      const { from, to } = getWeekRange();
      return `Semana: ${new Date(from + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })} – ${new Date(to + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    if (periodMode === 'month') {
      return new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
    }
    if (periodMode === 'custom' && customFrom && customTo) {
      return `${customFrom} — ${customTo}`;
    }
    return '';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {confirmDialog && <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />}
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-gray-500 hover:text-primary-600">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-display font-bold text-2xl text-gray-900">Citas</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPackage(true)}
              className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
            >
              <Package className="w-4 h-4" />
              Reserva de paquete
            </button>
            <button
              onClick={() => { setNewForm(EMPTY_FORM); setSlots([]); setCustomerQuery(''); setCustomerResults([]); setSelectedCustomer(null); setShowNew(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Nueva cita
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5 shadow-sm space-y-3">
          {/* Row 1: Period tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {PERIOD_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setPeriodMode(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  periodMode === tab.key
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Row 2: Status chips */}
          <div className="flex flex-wrap gap-1.5">
            {([['', 'Todos'], ...Object.entries(STATUS_MAP).map(([k, v]) => [k, v.label])] as [string, string][]).map(([k, label]) => {
              const active = statusFilter === k;
              const colorMap: Record<string, string> = {
                '':          active ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                pending:     active ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
                confirmed:   active ? 'bg-green-600 text-white'  : 'bg-green-50 text-green-700 hover:bg-green-100',
                completed:   active ? 'bg-blue-600 text-white'   : 'bg-blue-50 text-blue-700 hover:bg-blue-100',
                cancelled:   active ? 'bg-red-500 text-white'    : 'bg-red-50 text-red-600 hover:bg-red-100',
                no_show:     active ? 'bg-gray-500 text-white'   : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
              };
              return (
                <button
                  key={k}
                  onClick={() => setStatusFilter(k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${colorMap[k]}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Row 2: Date picker depending on mode */}
          {periodMode === 'day' && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSingleDate(today)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${singleDate === today ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Hoy
              </button>
              <div className="w-44">
                <DateTimePicker
                  mode="date"
                  theme="light"
                  value={singleDate || null}
                  onChange={d => setSingleDate(d)}
                />
              </div>
              {singleDate && (
                <span className="text-xs text-gray-400 capitalize">{periodSummary()}</span>
              )}
            </div>
          )}

          {periodMode === 'week' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-700 bg-primary-50 px-3 py-1.5 rounded-xl">
                {periodSummary()}
              </span>
            </div>
          )}

          {periodMode === 'month' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-700 bg-primary-50 px-3 py-1.5 rounded-xl capitalize">
                {periodSummary()}
              </span>
            </div>
          )}

          {periodMode === 'custom' && (
            <div className="max-w-xs">
              <DateTimePicker
                mode="range"
                theme="light"
                value={{ startDate: customFrom, endDate: customTo }}
                onChange={v => { setCustomFrom(v.startDate); setCustomTo(v.endDate); }}
              />
            </div>
          )}

          {/* Row 3: Client search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              placeholder="Buscar por nombre o teléfono del cliente..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {clientSearch && (
              <button
                onClick={() => setClientSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Results count */}
          {!loading && (
            <p className="text-xs text-gray-400">
              {filtered.length} cita{filtered.length !== 1 ? 's' : ''}
              {clientSearch ? ` para "${clientSearch}"` : ''}
              {appointments.length !== filtered.length ? ` de ${appointments.length} total` : ''}
            </p>
          )}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No hay citas para los filtros seleccionados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(() => {
              type Apt = Record<string, unknown>;
              const groups = new Map<string, Apt[]>();
              for (const apt of filtered) {
                const customerKey = (apt.guestEmail as string)
                  || (apt.customer as Record<string, unknown>)?.id as string
                  || (apt.guestPhone as string) || 'unknown';
                const dateStr = typeof apt.date === 'string' ? (apt.date as string).slice(0, 10) : '';
                const key = apt.packageId
                  ? `pkg:${apt.packageId}|${dateStr}|${customerKey}`
                  : `single:${apt.id}`;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(apt);
              }

              const sorted = Array.from(groups.entries()).sort((a, b) => {
                const aFirst = a[1][0];
                const bFirst = b[1][0];
                const ad = typeof aFirst.date === 'string' ? (aFirst.date as string).slice(0, 10) : '';
                const bd = typeof bFirst.date === 'string' ? (bFirst.date as string).slice(0, 10) : '';
                if (ad !== bd) return ad.localeCompare(bd);
                return String(aFirst.startTime || '').localeCompare(String(bFirst.startTime || ''));
              });

              return sorted.map(([key, group]) => {
                const isPackage = key.startsWith('pkg:');
                const first = group[0];

                if (!isPackage) {
                  const apt = first;
                  const s = STATUS_MAP[apt.status as keyof typeof STATUS_MAP] || { label: apt.status as string, color: 'bg-gray-100 text-gray-500' };
                  const canConfirm  = apt.status === 'pending';
                  const canComplete = apt.status === 'confirmed';
                  const canCancel   = apt.status === 'pending' || apt.status === 'confirmed';
                  const canNoShow   = apt.status === 'confirmed';
                  const aptDate = typeof apt.date === 'string' ? (apt.date as string).slice(0, 10) : '—';
                  return (
                    <div key={apt.id as string} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="font-bold text-gray-900">{apt.guestName as string || (apt.customer as Record<string, unknown>)?.name as string || 'Sin nombre'}</p>
                          <p className="text-sm text-gray-500">{apt.guestPhone as string}</p>
                        </div>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${s.color}`}>{s.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {aptDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {apt.startTime as string} – {apt.endTime as string}
                        </span>
                        <span className="font-medium text-gray-800">{(apt.service as Record<string, unknown>)?.name as string}</span>
                        <span className="text-gray-500">{(apt.staff as Record<string, unknown>)?.name as string}</span>
                        <span className="font-bold text-primary-600">S/ {Number(apt.totalPen).toFixed(2)}</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {canConfirm  && <button onClick={() => askStatus(apt, 'confirmed')} disabled={updating === apt.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-100 disabled:opacity-50"><Check className="w-3.5 h-3.5" /> Confirmar</button>}
                        {canComplete && <button onClick={() => askStatus(apt, 'completed')} disabled={updating === apt.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 disabled:opacity-50"><Check className="w-3.5 h-3.5" /> Completar</button>}
                        {canNoShow   && <button onClick={() => askStatus(apt, 'no_show')}   disabled={updating === apt.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-200 disabled:opacity-50">No asistió</button>}
                        {canCancel   && <button onClick={() => askStatus(apt, 'cancelled')} disabled={updating === apt.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 disabled:opacity-50"><X className="w-3.5 h-3.5" /> Cancelar</button>}
                      </div>
                    </div>
                  );
                }

                // ── Grupo de paquete ──
                const pkg = first.package as { id: string; name: string; eventType?: { name: string; accentColor: string; icon: string | null } } | null;
                const accent = pkg?.eventType?.accentColor || '#FF4FA2';
                const ds = typeof first.date === 'string' ? (first.date as string).slice(0, 10) : '';
                const totalGroup = group.reduce((s, a) => s + Number(a.totalPen || 0), 0);

                const customerKey = (first.guestEmail as string)
                  || (first.customer as Record<string, unknown>)?.id as string
                  || '';

                const allPending   = group.every(a => a.status === 'pending');
                const allConfirmed = group.every(a => a.status === 'confirmed');
                const canGroupComplete = group.some(a => a.status === 'confirmed');
                const canGroupCancel   = group.some(a => a.status === 'pending' || a.status === 'confirmed');
                const canGroupNoShow   = group.some(a => a.status === 'confirmed');
                const pkgName = pkg?.name || 'Paquete';

                return (
                  <div key={key} className="rounded-2xl border-2 overflow-hidden shadow-sm"
                    style={{ borderColor: accent, background: '#fff' }}>
                    {/* Package header */}
                    <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: `${accent}10` }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: `${accent}25`, color: accent }}>
                          {pkg?.eventType?.icon || '📦'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm" style={{ color: accent }}>
                            {pkg?.eventType?.name || 'Paquete'} · {pkgName}
                          </p>
                          <p className="text-xs text-gray-700">
                            {first.guestName as string || 'Cliente'} · {ds} · {group.length} servicios · <strong>S/{totalGroup.toFixed(2)}</strong>
                          </p>
                        </div>
                      </div>

                      {/* Group-level action buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {allPending && (
                          <button
                            onClick={async () => {
                              if (!pkg?.id || !ds || !customerKey) return;
                              if (!(await confirmAction({
                                title: 'Confirmar paquete',
                                message: <>¿Confirmar las <HL>{group.length} citas</HL> del paquete <HL>{pkgName}</HL> para el <New>{ds}</New>? Se enviará el correo de confirmación al cliente.</>,
                                confirmLabel: 'Sí, confirmar',
                              }))) return;
                              try {
                                setUpdating(key);
                                await adminApi(localStorage.getItem('admin_token') || '').appointments.confirmGroup(pkg.id, ds, customerKey);
                                await load(localStorage.getItem('admin_token') || '');
                              } catch (e) {
                                alert(e instanceof Error ? e.message : 'Error');
                              } finally {
                                setUpdating(null);
                              }
                            }}
                            disabled={updating === key}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white shrink-0 disabled:opacity-50"
                            style={{ background: accent }}
                          >
                            <Check className="w-3.5 h-3.5" />
                            Confirmar grupo
                          </button>
                        )}
                        {(allConfirmed || canGroupComplete) && !allPending && (
                          <button
                            onClick={() => askGroupStatus(
                              group.filter(a => a.status === 'confirmed'),
                              'completed', key, pkgName
                            )}
                            disabled={updating === key}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 disabled:opacity-50 shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Completar
                          </button>
                        )}
                        {canGroupNoShow && !allPending && (
                          <button
                            onClick={() => askGroupStatus(
                              group.filter(a => a.status === 'confirmed'),
                              'no_show', key, pkgName
                            )}
                            disabled={updating === key}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 disabled:opacity-50 shrink-0"
                          >
                            No asistió
                          </button>
                        )}
                        {canGroupCancel && (
                          <button
                            onClick={() => askGroupStatus(
                              group.filter(a => a.status === 'pending' || a.status === 'confirmed'),
                              'cancelled', key, pkgName
                            )}
                            disabled={updating === key}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 disabled:opacity-50 shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Individual services (read-only, no per-item buttons) */}
                    <div className="divide-y divide-gray-100">
                      {group.map((apt) => {
                        const s = STATUS_MAP[apt.status as keyof typeof STATUS_MAP] || { label: apt.status as string, color: 'bg-gray-100 text-gray-500' };
                        return (
                          <div key={apt.id as string} className="px-4 py-2.5 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {(apt.service as Record<string, unknown>)?.name as string}
                              </p>
                              <p className="text-xs text-gray-500">
                                {apt.startTime as string}–{apt.endTime as string} · {(apt.staff as Record<string, unknown>)?.name as string || (apt.onDutyStaff ? 'estilista de turno' : '—')}
                              </p>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.color} shrink-0`}>{s.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Modal: Nueva Cita */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-lg text-gray-900">Nueva Cita</h2>
              <button onClick={() => { setShowNew(false); setCustomerQuery(''); setCustomerResults([]); setSelectedCustomer(null); }} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Búsqueda de cliente existente */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Buscar cliente existente</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={customerQuery}
                    onChange={e => searchCustomers(e.target.value)}
                    placeholder="Nombre, teléfono o email..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {customerSearching && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Buscando...</span>
                  )}
                </div>
                {customerResults.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden shadow-lg bg-white z-10 max-h-40 overflow-y-auto">
                    {customerResults.map(c => (
                      <button
                        key={c.id as string}
                        type="button"
                        onClick={() => selectCustomer(c)}
                        className="w-full text-left px-3 py-2.5 hover:bg-primary-50 transition-colors border-b border-gray-100 last:border-0"
                      >
                        <p className="text-sm font-medium text-gray-900">{(c.fullName || c.name) as string}</p>
                        <p className="text-xs text-gray-500">{c.phone as string} · {c.email as string}</p>
                      </button>
                    ))}
                  </div>
                )}
                {selectedCustomer && (
                  <div className="mt-1.5 flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                    <UserCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Cliente: <strong>{(selectedCustomer.fullName || selectedCustomer.name) as string}</strong></span>
                    <button onClick={() => { setSelectedCustomer(null); setNewForm(f => ({ ...f, guestName: '', guestPhone: '' })); }}
                      className="ml-auto text-green-500 hover:text-green-700">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {!selectedCustomer && !customerQuery && (
                  <p className="text-xs text-gray-400 mt-1">O ingresa los datos manualmente abajo para un cliente nuevo</p>
                )}
              </div>

              {/* Datos del cliente */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={newForm.guestName}
                    onChange={e => setNewForm(f => ({ ...f, guestName: e.target.value }))}
                    placeholder="Nombre del cliente"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={newForm.guestPhone}
                    onChange={e => setNewForm(f => ({ ...f, guestPhone: e.target.value }))}
                    placeholder="+51 999 999 999"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Servicio */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Servicio *</label>
                <select
                  value={newForm.serviceId}
                  onChange={e => setNewForm(f => ({ ...f, serviceId: e.target.value, staffId: '', startTime: '', endTime: '' }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Seleccionar servicio...</option>
                  {services.filter(s => s.isActive).map(s => (
                    <option key={s.id as string} value={s.id as string}>
                      {s.name as string} — S/ {Number(s.pricePen).toFixed(0)} ({s.duration as number} min)
                    </option>
                  ))}
                </select>
              </div>

              {/* Estilista */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Estilista *</label>
                <select
                  value={newForm.staffId}
                  onChange={e => setNewForm(f => ({ ...f, staffId: e.target.value, startTime: '', endTime: '' }))}
                  disabled={!newForm.serviceId}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">Seleccionar estilista...</option>
                  {filteredStaff.filter(s => s.isActive).map(s => (
                    <option key={s.id as string} value={s.id as string}>{s.name as string}</option>
                  ))}
                </select>
                {newForm.serviceId && filteredStaff.filter(s => s.isActive).length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Ninguna estilista ofrece este servicio aún</p>
                )}
              </div>

              {/* Fecha y horario */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">Fecha y horario *</label>
                <DateTimePicker
                  mode="datetime"
                  variant="inline"
                  theme="light"
                  minDate={today}
                  value={{ date: newForm.date, startTime: newForm.startTime, endTime: newForm.endTime }}
                  availableSlots={newForm.serviceId && newForm.staffId ? slots : []}
                  slotsLoading={slotsLoading}
                  onChange={v => setNewForm(f => ({ ...f, date: v.date, startTime: v.startTime, endTime: v.endTime ?? '' }))}
                />
                {newForm.date && !(newForm.serviceId && newForm.staffId) && (
                  <p className="text-xs text-amber-600 mt-1">Selecciona servicio y estilista para ver los horarios disponibles.</p>
                )}
                {newForm.startTime && (
                  <p className="text-xs text-green-600 mt-1 font-medium">
                    Horario: {newForm.startTime} – {newForm.endTime}
                  </p>
                )}
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Notas</label>
                <textarea
                  value={newForm.notes}
                  onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Preferencias o indicaciones del cliente..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-5 pb-5">
              <button
                onClick={() => setShowNew(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={createAppointment}
                disabled={creating || !newForm.guestName || !newForm.serviceId || !newForm.staffId || !newForm.date || !newForm.startTime}
                className="px-5 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors"
              >
                {creating ? 'Guardando...' : 'Crear cita'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPackage && (
        <PackageBookingModal
          token={localStorage.getItem('admin_token') || ''}
          onClose={() => setShowPackage(false)}
          onCreated={(receiptNumber) => {
            setShowPackage(false);
            const token = localStorage.getItem('admin_token');
            if (token) load(token);
            setConfirmDialog({
              title: 'Reserva creada',
              message: receiptNumber
                ? <>La reserva de paquete fue registrada. Recibo <New>{receiptNumber}</New>.</>
                : 'La reserva de paquete fue registrada.',
              confirmLabel: 'Entendido',
              onConfirm: () => setConfirmDialog(null),
            });
          }}
        />
      )}
    </div>
  );
}
