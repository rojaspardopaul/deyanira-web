'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, Plus, Check, Clock, User, Scissors, Home, Phone, Mail,
  AlertCircle, Search, UserCheck,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import DateTimePicker from '@/components/ui/datetime';
import { STATUS } from '../status';
import { toYMD, clientName } from '../utils/date';
import { timeToMin, minToHHMM } from '../utils/time';
import type { Appointment, AptStatus, StaffMember, Slot } from '../types';

type AptModalProps = {
  /** Undefined = create mode; defined = edit/detail mode */
  apt?: Appointment;
  defaultDate?: string;
  defaultTime?: string;
  defaultStaffId?: string;
  staffList: StaffMember[];
  onClose: () => void;
  onCreated: (apt: Appointment) => void;
  onUpdated: (apt: Appointment) => void;
  onStatusChanged: (id: string, status: AptStatus) => Promise<void>;
  adminRole: 'super_admin' | 'admin' | 'estilista';
};

type PendingAction = {
  type: AptStatus;
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
};

const EMPTY_FORM = {
  date: '', startTime: '', serviceId: '', staffId: '',
  guestName: '', guestPhone: '', guestEmail: '', notes: '',
};

export function AptModal({
  apt, defaultDate = '', defaultTime = '', defaultStaffId = '',
  staffList, onClose, onCreated, onUpdated, onStatusChanged, adminRole,
}: AptModalProps) {
  const isEdit = !!apt;
  const todayStr = toYMD(new Date());

  // ── Create-mode state ────────────────────────────────────────────────────
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    date: defaultDate,
    startTime: defaultTime,
    staffId: defaultStaffId,
  });
  const [services, setServices] = useState<{ id: string; name: string; duration: number }[]>([]);
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<{ id: string; name: string; phone?: string }[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Edit-mode state ──────────────────────────────────────────────────────
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(apt?.staff?.id || '');
  const [assignError, setAssignError] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isEdit) return;
    adminApi().services.list()
      .then((d: unknown) => setServices(d as { id: string; name: string; duration: number }[]))
      .catch(() => {});
  }, [isEdit]);

  useEffect(() => {
    if (isEdit || !form.serviceId || !form.date) { setAvailableSlots([]); return; }
    setLoadingSlots(true);
    const qs = new URLSearchParams({ serviceId: form.serviceId, date: form.date });
    if (form.staffId) qs.set('staffId', form.staffId);
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/appointments/availability?${qs}`)
      .then(r => r.json())
      .then((slots: Slot[]) => setAvailableSlots(Array.isArray(slots) ? slots : []))
      .catch(() => setAvailableSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [isEdit, form.serviceId, form.date, form.staffId]);

  useEffect(() => {
    if (isEdit || !customerQuery.trim()) { setCustomerResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await adminApi().customers.search(customerQuery) as { name: string; phone?: string; id: string }[];
        setCustomerResults(data);
      } catch { setCustomerResults([]); }
    }, 300);
  }, [isEdit, customerQuery]);

  // ── Create helpers ───────────────────────────────────────────────────────
  function field(key: keyof typeof EMPTY_FORM, val: string) {
    setForm(f => ({ ...f, [key]: val }));
    setError('');
  }

  const selectedService = services.find(s => s.id === form.serviceId);
  const computedEndTime = useMemo(() => {
    if (!selectedService || !form.startTime) return '';
    return minToHHMM(timeToMin(form.startTime) + selectedService.duration);
  }, [selectedService, form.startTime]);

  const isTimeAvailable = useMemo(() => {
    if (!form.staffId || !form.startTime || availableSlots.length === 0) return true;
    return availableSlots.some(s => s.start === form.startTime);
  }, [form.staffId, form.startTime, availableSlots]);

  async function handleCreate() {
    if (!form.guestName.trim()) { setError('El nombre del cliente es obligatorio'); return; }
    if (!form.serviceId) { setError('Selecciona un servicio'); return; }
    if (!form.date) { setError('Selecciona una fecha'); return; }
    if (!form.startTime) { setError('Selecciona la hora de inicio'); return; }
    if (form.date < todayStr) { setError('No se pueden crear citas en fechas pasadas'); return; }
    if (form.staffId && !isTimeAvailable) {
      setError('La estilista no está disponible en ese horario. Elige otra hora.');
      return;
    }
    setSaving(true); setError('');
    try {
      const created = await adminApi().appointments.create({ ...form, endTime: computedEndTime });
      onCreated(created as Appointment);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear cita');
    } finally { setSaving(false); }
  }

  // ── Edit helpers ─────────────────────────────────────────────────────────
  function toast(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  }

  async function executeStatusAction() {
    if (!pendingAction || !apt) return;
    setActionLoading(true);
    try {
      await onStatusChanged(apt.id, pendingAction.type);
      toast(pendingAction.confirmLabel + ' con éxito');
      setPendingAction(null);
    } finally { setActionLoading(false); }
  }

  async function handleAssign() {
    if (!selectedStaff || !apt) return;
    const staffName = staffList.find(s => s.id === selectedStaff)?.name || '';
    const isChange = !!apt.staff;
    setAssigning(true); setAssignError('');
    try {
      const updated = await adminApi().appointments.update(apt.id, { staffId: selectedStaff }) as Appointment;
      onUpdated(updated);
      toast(isChange ? `Estilista cambiada a ${staffName}` : `Estilista asignada: ${staffName}`);
      setShowStaffForm(false);
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : 'Error al asignar');
    } finally { setAssigning(false); }
  }

  // ── Confirmation dialog (replaces content during confirm flow) ───────────
  if (pendingAction) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5 flex flex-col gap-4">
          <div>
            <h3 className="font-bold text-gray-900 text-base">{pendingAction.title}</h3>
            {pendingAction.description && (
              <p className="text-sm text-gray-500 mt-1">{pendingAction.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPendingAction(null)}
              disabled={actionLoading}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={executeStatusAction}
              disabled={actionLoading}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors ${
                pendingAction.danger
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-gold-400 hover:bg-gold-500 text-gray-900'
              }`}
            >
              {actionLoading ? 'Procesando...' : pendingAction.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Create mode ──────────────────────────────────────────────────────────
  if (!isEdit) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-gold-500" /> Nueva cita
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4 space-y-3 flex-1">
            {/* Customer search */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Buscar cliente existente</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  value={customerQuery}
                  onChange={e => setCustomerQuery(e.target.value)}
                  placeholder="Nombre, email o teléfono..."
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-400"
                />
              </div>
              {customerResults.length > 0 && (
                <div className="border border-gray-200 rounded-xl mt-1 divide-y divide-gray-100 max-h-32 overflow-y-auto">
                  {customerResults.map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        field('guestName', c.name);
                        field('guestPhone', c.phone || '');
                        setCustomerResults([]);
                        setCustomerQuery('');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-amber-50 text-left"
                    >
                      <User className="w-3 h-3 text-gray-400" />
                      {c.name}
                      {c.phone && <span className="text-gray-400">· {c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre *</label>
                <input value={form.guestName} onChange={e => field('guestName', e.target.value)}
                  placeholder="Nombre completo"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Teléfono</label>
                <input value={form.guestPhone} onChange={e => field('guestPhone', e.target.value)}
                  placeholder="987654321"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Servicio *</label>
              <select value={form.serviceId} onChange={e => field('serviceId', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-400 bg-white">
                <option value="">Seleccionar servicio...</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Estilista</label>
              <select value={form.staffId} onChange={e => field('staffId', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-400 bg-white">
                <option value="">Estilista de turno (asignar luego)</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha y hora *</label>
              <DateTimePicker
                mode="datetime"
                variant="inline"
                theme="light"
                minDate={todayStr}
                value={{ date: form.date, startTime: form.startTime }}
                availableSlots={form.serviceId ? availableSlots : []}
                slotsLoading={loadingSlots}
                onChange={v => { field('date', v.date); field('startTime', v.startTime); }}
              />
              {form.date && !form.serviceId && (
                <p className="text-xs text-amber-600 mt-1">Selecciona un servicio para ver los horarios disponibles.</p>
              )}
            </div>

            {form.staffId && form.serviceId && form.date && !loadingSlots && availableSlots.length === 0 && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Esta estilista no tiene horarios disponibles en la fecha seleccionada.
              </div>
            )}

            {selectedService && form.startTime && (
              <p className="text-xs text-gray-500">
                Termina a las <strong>{computedEndTime}</strong> &middot; {selectedService.duration} min
              </p>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notas</label>
              <textarea value={form.notes} onChange={e => field('notes', e.target.value)} rows={2}
                placeholder="Indicaciones especiales..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-400 resize-none" />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={handleCreate} disabled={saving}
              className="flex-1 py-2.5 bg-gold-400 hover:bg-gold-500 text-gray-900 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors">
              {saving ? 'Creando...' : 'Crear cita'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Edit/detail mode ─────────────────────────────────────────────────────
  const cfg = STATUS[apt.status];
  const canAct = apt.status !== 'completed' && apt.status !== 'cancelled' && apt.status !== 'no_show';
  const canCancel = adminRole !== 'estilista';
  const canManageStaff = adminRole !== 'estilista' && apt.status !== 'cancelled' && apt.status !== 'no_show';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Status bar */}
        <div className={`h-1.5 w-full ${cfg.bgFull} rounded-t-2xl`} />

        {/* Header */}
        <div className={`px-5 py-3 border-b border-gray-100 flex items-center justify-between ${cfg.bgLight}`}>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bgLight} ${cfg.text} flex items-center gap-1.5`}>
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {successMsg && (
            <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-semibold flex items-center gap-2">
              <Check className="w-3.5 h-3.5 shrink-0" /> {successMsg}
            </div>
          )}

          {/* Time + service */}
          <div className={`${cfg.bgLight} border-l-4 ${cfg.border} rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <Clock className={`w-4 h-4 ${cfg.text}`} />
              <span className="font-bold text-gray-900 text-lg">{apt.startTime} &ndash; {apt.endTime}</span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700 flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-gray-400" />{apt.service.name}
              </p>
              <p className="text-base font-bold text-gray-900">S/ {Number(apt.totalPen).toFixed(2)}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1 pl-5">{apt.service.duration} min</p>
          </div>

          {/* Client */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Cliente</p>
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-900">{clientName(apt)}</span>
            </div>
            {apt.guestPhone && (
              <a href={`tel:${apt.guestPhone}`} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700">{apt.guestPhone}</span>
              </a>
            )}
            {apt.guestEmail && (
              <a href={`mailto:${apt.guestEmail}`} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700 truncate">{apt.guestEmail}</span>
              </a>
            )}
            {apt.atHome && (
              <div className="flex items-center gap-2 p-2 bg-purple-50 border border-purple-100 rounded-lg">
                <Home className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-purple-700">
                  A domicilio{apt.atHomeDistrict ? ` · ${apt.atHomeDistrict}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Stylist */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Estilista</p>
              {canManageStaff && (
                <button
                  onClick={() => { setShowStaffForm(v => !v); setAssignError(''); setSelectedStaff(apt.staff?.id || ''); }}
                  className="text-[11px] font-semibold text-gold-600 hover:text-gold-700"
                >
                  {showStaffForm ? 'Cerrar' : apt.staff ? 'Cambiar' : 'Asignar'}
                </button>
              )}
            </div>
            {apt.staff ? (
              <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                <UserCheck className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold text-blue-700">{apt.staff.name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 bg-purple-50 border border-purple-100 rounded-lg">
                <span className="text-sm text-purple-700 italic">Estilista de turno (sin asignar)</span>
              </div>
            )}
            {showStaffForm && canManageStaff && (
              <div className="border border-gold-300 rounded-xl p-3 bg-amber-50/40 space-y-2">
                <select
                  value={selectedStaff}
                  onChange={e => { setSelectedStaff(e.target.value); setAssignError(''); }}
                  className="w-full text-sm border border-gold-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold-400"
                >
                  <option value="">Seleccionar estilista...</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {assignError && (
                  <p className="text-[11px] text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />{assignError}
                  </p>
                )}
                <button
                  disabled={!selectedStaff || assigning || selectedStaff === apt.staff?.id}
                  onClick={handleAssign}
                  className="w-full py-1.5 bg-gold-400 hover:bg-gold-500 text-gray-900 text-xs font-bold rounded-lg disabled:opacity-40 transition-colors"
                >
                  {assigning ? 'Guardando...' : apt.staff ? 'Cambiar estilista' : 'Asignar estilista'}
                </button>
              </div>
            )}
          </div>

          {apt.notes && (
            <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-xl">
              <p className="text-[11px] font-bold uppercase tracking-wider text-yellow-700 mb-1">Notas</p>
              <p className="text-xs text-yellow-700 italic">{apt.notes}</p>
            </div>
          )}

          {/* Status actions */}
          {canAct && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              {apt.status === 'pending' && (
                <button
                  onClick={() => setPendingAction({
                    type: 'confirmed', confirmLabel: 'Confirmar',
                    title: '¿Confirmar esta cita?',
                    description: `${clientName(apt)} · ${apt.startTime}`,
                  })}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Check className="w-4 h-4" /> Confirmar cita
                </button>
              )}
              {apt.status === 'confirmed' && (
                <>
                  <button
                    onClick={() => setPendingAction({
                      type: 'in_progress', confirmLabel: 'Iniciar',
                      title: '¿Marcar la cita en curso?',
                      description: `${clientName(apt)} · ${apt.startTime}`,
                    })}
                    className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <Check className="w-4 h-4" /> Iniciar (en curso)
                  </button>
                  <button
                    onClick={() => setPendingAction({
                      type: 'completed', confirmLabel: 'Marcar atendida',
                      title: '¿Marcar como atendida?',
                      description: `${clientName(apt)} · ${apt.startTime}`,
                    })}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <Check className="w-4 h-4" /> Marcar atendida
                  </button>
                  <button
                    onClick={() => setPendingAction({
                      type: 'no_show', confirmLabel: 'Confirmar',
                      title: '¿El cliente no asistió?',
                      description: 'Esta acción cambiará el estado a "No asistió".',
                    })}
                    className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
                  >
                    Cliente no asistió
                  </button>
                </>
              )}
              {apt.status === 'in_progress' && (
                <button
                  onClick={() => setPendingAction({
                    type: 'completed', confirmLabel: 'Marcar atendida',
                    title: '¿Marcar como atendida?',
                    description: `${clientName(apt)} · ${apt.startTime}`,
                  })}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Check className="w-4 h-4" /> Marcar atendida
                </button>
              )}
              {canCancel && (
                <button
                  onClick={() => setPendingAction({
                    type: 'cancelled', confirmLabel: 'Cancelar cita', danger: true,
                    title: '¿Cancelar esta cita?',
                    description: 'Esta acción no se puede deshacer.',
                  })}
                  className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-xl flex items-center justify-center gap-1 transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Cancelar cita
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
