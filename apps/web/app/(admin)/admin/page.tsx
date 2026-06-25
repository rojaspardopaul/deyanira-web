'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar, CalendarDays, Clock, Check, X, Users, Wallet, TrendingUp,
  CalendarCheck, CalendarClock, UserX, ShoppingBag, Package, Settings, Image,
  Scissors, UserCog, ReceiptText, BarChart3, ArrowRight,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import KpiCard from '@/components/admin/finanzas/KpiCard';
import { ConfirmModal, type ConfirmDialogConfig } from '@/components/ui/ConfirmModal';
import { HL, New, Danger } from '@/components/ui/highlight';
import { fmtTime12 } from '@/lib/time';
import DateTimePicker from '@/components/ui/datetime';
import { STATUS_MAP, STATUS_ORDER } from '@/lib/appointmentStatus';
import { toISO, getWeekRange, getMonthRange, previousRange, type PeriodMode } from '@/lib/period';

const AppointmentCharts = dynamic(() => import('@/components/admin/dashboard/AppointmentCharts'), { ssr: false });

type Apt = Record<string, unknown>;

const PERIOD_TABS: { key: PeriodMode; label: string }[] = [
  { key: 'day', label: 'Día' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'custom', label: 'Personalizado' },
];

const fmtPen = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function variationPct(cur: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

function customerKey(a: Apt): string {
  return (a.customerId as string)
    || ((a.customer as Apt)?.id as string)
    || (a.guestEmail as string)
    || (a.guestPhone as string)
    || (a.id as string);
}

export default function AdminDashboard() {
  const router = useRouter();
  const [role, setRole] = useState('admin');
  const [token, setToken] = useState('');

  // Período
  const [periodMode, setPeriodMode] = useState<PeriodMode>('day');
  const [singleDate, setSingleDate] = useState(() => toISO(new Date()));
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Filtros
  const [staffId, setStaffId] = useState('');
  const [staffList, setStaffList] = useState<Apt[]>([]);
  const [statusFilter, setStatusFilter] = useState('');

  // Datos
  const [appts, setAppts] = useState<Apt[]>([]);
  const [prevCount, setPrevCount] = useState({ total: 0, completed: 0, ingresos: 0 });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig | null>(null);

  const isEstilista = role === 'estilista';

  // Rango activo (from/to en YYYY-MM-DD).
  const range = useMemo(() => {
    if (periodMode === 'day') return { from: singleDate, to: singleDate };
    if (periodMode === 'week') return getWeekRange();
    if (periodMode === 'month') return getMonthRange();
    return { from: customFrom, to: customTo };
  }, [periodMode, singleDate, customFrom, customTo]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('admin_user') || '{}');
      if (stored.role) setRole(stored.role);
    } catch { /* ignore */ }
    const t = localStorage.getItem('admin_token');
    if (!t) { router.push('/admin/login'); return; }
    setToken(t);
    adminApi(t).staff.list().then((s) => setStaffList(s as Apt[])).catch(() => setStaffList([]));
  }, [router]);

  const load = useCallback(async () => {
    if (!token || !range.from || !range.to) return;
    setLoading(true);
    const prev = previousRange(range.from, range.to);
    const buildParams = (from: string, to: string) => {
      const p = new URLSearchParams({ dateFrom: from, dateTo: to });
      if (staffId) p.set('staffId', staffId);
      return p.toString();
    };
    try {
      const [cur, prevList] = await Promise.all([
        adminApi(token).appointments.list(buildParams(range.from, range.to)) as Promise<Apt[]>,
        adminApi(token).appointments.list(buildParams(prev.from, prev.to)) as Promise<Apt[]>,
      ]);
      setAppts(Array.isArray(cur) ? cur : []);
      const pl = Array.isArray(prevList) ? prevList : [];
      const pComp = pl.filter((a) => a.status === 'completed');
      setPrevCount({
        total: pl.length,
        completed: pComp.length,
        ingresos: pComp.reduce((s, a) => s + Number(a.totalPen || 0), 0),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (msg.includes('401') || msg.includes('token')) {
        localStorage.removeItem('admin_token');
        router.push('/admin/login');
        return;
      }
      setAppts([]);
    } finally {
      setLoading(false);
    }
  }, [token, range, staffId, router]);

  useEffect(() => { load(); }, [load]);

  // ── Agregados (KPIs + diagramas) ──────────────────────────────
  const k = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const s of STATUS_ORDER) byStatus[s] = 0;
    let ingresos = 0;
    const clientes = new Set<string>();
    for (const a of appts) {
      const st = a.status as string;
      byStatus[st] = (byStatus[st] ?? 0) + 1;
      if (st === 'completed') {
        ingresos += Number(a.totalPen || 0);
        clientes.add(customerKey(a));
      }
    }
    const completadas = byStatus.completed || 0;
    return {
      total: appts.length,
      byStatus,
      ingresos,
      completadas,
      ticket: completadas > 0 ? ingresos / completadas : 0,
      clientes: clientes.size,
    };
  }, [appts]);

  const porEstado = useMemo(
    () => STATUS_ORDER.map((s) => ({
      key: s, label: STATUS_MAP[s].label, value: k.byStatus[s] || 0, hex: STATUS_MAP[s].hex,
    })),
    [k],
  );

  const porEstilista = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of appts) {
      const name = ((a.staff as Apt)?.name as string)
        || (a.onDutyStaff ? 'Estilista de turno' : 'Sin asignar');
      m.set(name, (m.get(name) || 0) + 1);
    }
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [appts]);

  // ── Acciones de estado (con confirmación) ─────────────────────
  async function doUpdateStatus(id: string, status: string) {
    if (!token) return;
    setUpdating(id);
    try {
      await adminApi(token).appointments.update(id, { status });
      setAppts((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setUpdating(null);
    }
  }

  function askStatus(apt: Apt, newStatus: string) {
    const name = (apt.guestName || (apt.customer as Apt)?.name || 'el cliente') as string;
    const time = fmtTime12(apt.startTime as string);
    const cfg: Record<string, Omit<ConfirmDialogConfig, 'onConfirm'>> = {
      confirmed: { title: 'Confirmar cita', message: <>¿Confirmar la cita de <HL>{name}</HL> a las <New>{time}</New>?</>, confirmLabel: 'Sí, confirmar', confirmClass: 'bg-green-600 hover:bg-green-500' },
      completed: { title: 'Marcar como atendida', message: <>¿Marcar la cita de <HL>{name}</HL> (<HL>{time}</HL>) como <New>atendida</New>?</>, confirmLabel: 'Sí, completar', confirmClass: 'bg-blue-600 hover:bg-blue-500' },
      cancelled: { title: 'Cancelar cita', message: <>¿Cancelar la cita de <HL>{name}</HL> de las <HL>{time}</HL>? <Danger>No se puede deshacer.</Danger></>, confirmLabel: 'Sí, cancelar', confirmClass: 'bg-red-600 hover:bg-red-500' },
      no_show:   { title: 'No asistió', message: <>¿Marcar que <HL>{name}</HL> <Danger>no asistió</Danger> a su cita de las <HL>{time}</HL>?</>, confirmLabel: 'Sí, marcar', confirmClass: 'bg-gray-600 hover:bg-gray-500' },
    };
    const c = cfg[newStatus];
    if (!c) return;
    setConfirmDialog({ ...c, onConfirm: () => doUpdateStatus(apt.id as string, newStatus) });
  }

  // ── Agenda agrupada (paquetes vs individuales) ────────────────
  const filteredAppts = useMemo(
    () => statusFilter ? appts.filter((a) => a.status === statusFilter) : appts,
    [appts, statusFilter],
  );

  const agendaGroups = useMemo(() => {
    const groups = new Map<string, Apt[]>();
    for (const a of filteredAppts) {
      const dateStr = typeof a.date === 'string' ? (a.date as string).slice(0, 10) : '';
      // Solo las citas de PAQUETE se agrupan; el resto va individual (accionable).
      const key = a.packageId
        ? (a.bookingGroupId ? `grp:${a.bookingGroupId}` : `pkg:${a.packageId}|${dateStr}|${customerKey(a)}`)
        : `single:${a.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a);
    }
    return Array.from(groups.entries()).sort((x, y) => {
      const xa = x[1][0], ya = y[1][0];
      const xd = typeof xa.date === 'string' ? (xa.date as string).slice(0, 10) : '';
      const yd = typeof ya.date === 'string' ? (ya.date as string).slice(0, 10) : '';
      if (xd !== yd) return xd.localeCompare(yd);
      return String(xa.startTime || '').localeCompare(String(ya.startTime || ''));
    });
  }, [filteredAppts]);

  const today = toISO(new Date());

  // KPI clickable: alterna el filtro de estado.
  const toggleStatus = (s: string) => setStatusFilter((cur) => (cur === s ? '' : s));

  const quickTiles = ([
    { href: '/admin/calendario',    label: 'Calendario',   icon: CalendarDays, bg: 'bg-amber-50',    text: 'text-gold-600',    border: 'border-amber-100',   roles: ['super_admin','admin','estilista'] },
    { href: '/admin/citas',         label: 'Citas',         icon: Calendar,    bg: 'bg-amber-50',    text: 'text-gold-600',    border: 'border-amber-100',   roles: ['super_admin','admin','estilista'] },
    { href: '/admin/horarios',      label: 'Horarios',      icon: Clock,       bg: 'bg-indigo-50',  text: 'text-indigo-600',  border: 'border-indigo-100',  roles: ['super_admin','admin','estilista'] },
    { href: '/admin/clientes',      label: 'Clientes',      icon: Users,       bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-100',    roles: ['super_admin','admin'] },
    { href: '/admin/pedidos',       label: 'Pedidos',       icon: ShoppingBag, bg: 'bg-orange-50',  text: 'text-orange-600',  border: 'border-orange-100',  roles: ['super_admin','admin'] },
    { href: '/admin/pagos',         label: 'Adelantos',     icon: ReceiptText, bg: 'bg-pink-50',    text: 'text-pink-600',    border: 'border-pink-100',    roles: ['super_admin','admin'] },
    { href: '/admin/contabilidad',  label: 'Contabilidad',  icon: BarChart3,   bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', roles: ['super_admin','admin'] },
    { href: '/admin/servicios',     label: 'Servicios',     icon: Scissors,    bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-100',  roles: ['super_admin','admin'] },
    { href: '/admin/paquetes',      label: 'Paquetes',      icon: Package,     bg: 'bg-rose-50',    text: 'text-rose-600',    border: 'border-rose-100',    roles: ['super_admin','admin'] },
    { href: '/admin/galeria',       label: 'Imágenes',      icon: Image,       bg: 'bg-teal-50',    text: 'text-teal-600',    border: 'border-teal-100',    roles: ['super_admin','admin'] },
    { href: '/admin/productos',     label: 'Productos',     icon: Package,     bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-100',   roles: ['super_admin','admin'] },
    { href: '/admin/estilistas',    label: 'Estilistas',    icon: UserCog,     bg: 'bg-teal-50',    text: 'text-teal-600',    border: 'border-teal-100',    roles: ['super_admin','admin'] },
    { href: '/admin/configuracion', label: 'Config.',       icon: Settings,    bg: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-200',    roles: ['super_admin','admin'] },
    { href: '/admin/usuarios',      label: 'Usuarios',      icon: UserCog,     bg: 'bg-purple-50',  text: 'text-purple-600',  border: 'border-purple-100',  roles: ['super_admin'] },
  ] as { href: string; label: string; icon: React.ElementType; bg: string; text: string; border: string; roles: string[] }[])
    .filter((t) => t.roles.includes(role));

  function periodSummary() {
    if (periodMode === 'day') {
      const d = new Date(singleDate + 'T12:00:00');
      const txt = d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
      return singleDate === today ? `Hoy, ${txt}` : txt;
    }
    if (!range.from || !range.to) return '';
    const a = new Date(range.from + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
    const b = new Date(range.to + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${a} – ${b}`;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {confirmDialog && <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />}
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold">Dashboard de citas</h1>
            <p className="text-gray-500 text-sm mt-1 capitalize">{periodSummary()}</p>
          </div>
          <Link href="/admin/citas" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 self-start sm:self-auto">
            Gestionar todas las citas <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Selector de período + estilista */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {PERIOD_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setPeriodMode(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  periodMode === tab.key ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {periodMode === 'day' && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSingleDate(today)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${singleDate === today ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Hoy
              </button>
              <div className="w-56 sm:w-64">
                <DateTimePicker mode="date" theme="light" value={singleDate || null} onChange={(d) => setSingleDate(d)} />
              </div>
            </div>
          )}
          {periodMode === 'custom' && (
            <div className="max-w-xs w-full">
              <DateTimePicker
                mode="range"
                theme="light"
                value={{ startDate: customFrom, endDate: customTo }}
                onChange={(v) => { setCustomFrom(v.startDate); setCustomTo(v.endDate); }}
              />
            </div>
          )}

          {!isEstilista && staffList.length > 0 && (
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="sm:ml-auto border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="">Todas las estilistas</option>
              {staffList.map((s) => <option key={s.id as string} value={s.id as string}>{s.name as string}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* KPIs (clickables = filtro) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <KpiCard label="Total citas" value={String(k.total)} icon={Calendar} tone="gray"
                variation={variationPct(k.total, prevCount.total)}
                active={statusFilter === ''} onClick={() => setStatusFilter('')} hint="Ver todas" />
              <KpiCard label="Pendientes" value={String(k.byStatus.pending || 0)} icon={CalendarClock} tone="amber"
                active={statusFilter === 'pending'} onClick={() => toggleStatus('pending')} hint="Por confirmar" />
              <KpiCard label="Confirmadas" value={String(k.byStatus.confirmed || 0)} icon={CalendarCheck} tone="emerald"
                active={statusFilter === 'confirmed'} onClick={() => toggleStatus('confirmed')} />
              <KpiCard label="Completadas" value={String(k.completadas)} icon={Check} tone="blue"
                variation={variationPct(k.completadas, prevCount.completed)}
                active={statusFilter === 'completed'} onClick={() => toggleStatus('completed')} hint="Atendidas" />
              <KpiCard label="Canceladas" value={String(k.byStatus.cancelled || 0)} icon={X} tone="red"
                active={statusFilter === 'cancelled'} onClick={() => toggleStatus('cancelled')} />
              <KpiCard label="No asistió" value={String(k.byStatus.no_show || 0)} icon={UserX} tone="gray"
                active={statusFilter === 'no_show'} onClick={() => toggleStatus('no_show')} />
              <KpiCard label="Ingresos" value={fmtPen(k.ingresos)} icon={Wallet} tone="emerald"
                variation={variationPct(k.ingresos, prevCount.ingresos)} hint="De citas atendidas" />
              <KpiCard label="Ticket promedio" value={fmtPen(k.ticket)} icon={TrendingUp} tone="purple" hint={`${k.clientes} cliente${k.clientes !== 1 ? 's' : ''} atendido${k.clientes !== 1 ? 's' : ''}`} />
            </div>

            {/* Diagramas */}
            <div className="mb-6">
              <AppointmentCharts porEstado={porEstado} porEstilista={porEstilista} />
            </div>

            {/* Agenda accionable */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="font-semibold text-base">
                  Agenda{statusFilter ? ` · ${STATUS_MAP[statusFilter]?.label}` : ''}
                  <span className="ml-2 text-sm font-normal text-gray-400">{filteredAppts.length}</span>
                </h2>
                {statusFilter && (
                  <button onClick={() => setStatusFilter('')} className="text-xs font-semibold text-primary-600 hover:text-primary-700">
                    Quitar filtro
                  </button>
                )}
              </div>

              {agendaGroups.length === 0 ? (
                <div className="text-center py-14 text-gray-400">
                  <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                  <p className="text-sm">No hay citas para este filtro.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agendaGroups.map(([key, group]) => {
                    const isPackage = key.startsWith('pkg:') || key.startsWith('grp:');
                    const first = group[0];
                    const ds = typeof first.date === 'string' ? (first.date as string).slice(0, 10) : '';

                    // ── Cita individual (accionable) ──
                    if (!isPackage) {
                      const apt = first;
                      const s = STATUS_MAP[apt.status as string] || { label: apt.status as string, color: 'bg-gray-100 text-gray-500' };
                      const canConfirm  = apt.status === 'pending';
                      const canComplete = apt.status === 'confirmed';
                      const canNoShow   = apt.status === 'confirmed';
                      const canCancel   = apt.status === 'pending' || apt.status === 'confirmed';
                      return (
                        <div key={apt.id as string} className="border border-gray-100 rounded-xl p-3.5">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 text-sm truncate">{(apt.guestName || (apt.customer as Apt)?.name || 'Sin nombre') as string}</p>
                              <p className="text-xs text-gray-500">{apt.guestPhone as string}</p>
                            </div>
                            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${s.color}`}>{s.label}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 mb-2.5">
                            <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-gray-400" />{ds}</span>
                            <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-400" />{fmtTime12(apt.startTime as string)}</span>
                            <span className="font-medium text-gray-800">{(apt.service as Apt)?.name as string}</span>
                            <span className="text-gray-500">{(apt.staff as Apt)?.name as string || (apt.onDutyStaff ? 'Estilista de turno' : '')}</span>
                            <span className="font-bold text-primary-600">{fmtPen(Number(apt.totalPen || 0))}</span>
                          </div>
                          {(canConfirm || canComplete || canNoShow || canCancel) && (
                            <div className="flex gap-2 flex-wrap">
                              {canConfirm  && <button onClick={() => askStatus(apt, 'confirmed')} disabled={updating === apt.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-100 disabled:opacity-50"><Check className="w-3.5 h-3.5" /> Confirmar</button>}
                              {canComplete && <button onClick={() => askStatus(apt, 'completed')} disabled={updating === apt.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 disabled:opacity-50"><Check className="w-3.5 h-3.5" /> Completar</button>}
                              {canNoShow   && <button onClick={() => askStatus(apt, 'no_show')} disabled={updating === apt.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-200 disabled:opacity-50">No asistió</button>}
                              {canCancel   && <button onClick={() => askStatus(apt, 'cancelled')} disabled={updating === apt.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 disabled:opacity-50"><X className="w-3.5 h-3.5" /> Cancelar</button>}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // ── Grupo de paquete (resumen + enlace a Citas) ──
                    const pkg = first.package as { name?: string; eventType?: { name?: string; accentColor?: string; icon?: string | null } } | null;
                    const accent = pkg?.eventType?.accentColor || '#FF4FA2';
                    const total = group.reduce((sum, a) => sum + Number(a.totalPen || 0), 0);
                    return (
                      <div key={key} className="rounded-xl border-2 overflow-hidden" style={{ borderColor: accent }}>
                        <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap" style={{ background: `${accent}10` }}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: `${accent}25`, color: accent }}>
                              {pkg?.eventType?.icon || '📦'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-xs truncate" style={{ color: accent }}>{pkg?.eventType?.name || 'Paquete'} · {pkg?.name || 'Paquete'}</p>
                              <p className="text-[11px] text-gray-700">{(first.guestName as string) || 'Cliente'} · {ds} · {group.length} servicios · <strong>{fmtPen(total)}</strong></p>
                            </div>
                          </div>
                          <Link href="/admin/citas" className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0" style={{ background: accent, color: '#fff' }}>
                            Gestionar <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {group.map((apt) => {
                            const s = STATUS_MAP[apt.status as string] || { label: apt.status as string, color: 'bg-gray-100 text-gray-500' };
                            return (
                              <div key={apt.id as string} className="px-3.5 py-2 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-gray-800 truncate">{(apt.service as Apt)?.name as string}</p>
                                  <p className="text-[11px] text-gray-500">{fmtTime12(apt.startTime as string)} · {(apt.staff as Apt)?.name as string || (apt.onDutyStaff ? 'turno' : '—')}</p>
                                </div>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${s.color}`}>{s.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Accesos rápidos */}
        <div className="mt-8">
          <h2 className="font-semibold text-sm text-gray-500 mb-3">Accesos rápidos</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-3">
            {quickTiles.map(({ href, label, icon: Icon, bg, text, border }) => (
              <Link key={href} href={href}
                className={`flex flex-col items-center gap-2 p-3 bg-white border rounded-2xl shadow-sm hover:shadow-md transition-shadow ${border}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg} ${text}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center leading-tight">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
