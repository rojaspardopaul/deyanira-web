'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, X, Clock, CalendarX, Calendar } from 'lucide-react';
import { adminApi } from '@/lib/api';
import DateTimePicker from '@/components/ui/datetime';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

interface StaffMember { id: string; name: string; role: string | null; }
interface Schedule { id?: string; dayOfWeek: number; startTime: string; endTime: string; enabled: boolean; }
interface UnavailBlock { id: string; date: string; startTime: string | null; endTime: string | null; reason: string | null; staff: { name: string } | null; staffId: string | null; }

// Horario por defecto: Lun–Sáb 08:00–20:00
function defaultSchedules(): Schedule[] {
  return DAYS.map((_, i) => ({
    dayOfWeek: i,
    startTime: '08:00',
    endTime: '20:00',
    enabled: i >= 1 && i <= 6, // Lun-Sáb activos, Dom descanso
  }));
}

function mergeServerSchedules(serverSchedules: { dayOfWeek: number; startTime: string; endTime: string }[]): Schedule[] {
  const base = defaultSchedules();
  const byDay = new Map(serverSchedules.map(s => [s.dayOfWeek, s]));
  return base.map(d => {
    const s = byDay.get(d.dayOfWeek);
    if (s) return { dayOfWeek: d.dayOfWeek, startTime: s.startTime, endTime: s.endTime, enabled: true };
    return { ...d, enabled: false };
  });
}

export default function HorariosPage() {
  const [tab, setTab] = useState<'schedules' | 'blocks'>('schedules');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [schedules, setSchedules] = useState<Schedule[]>(defaultSchedules());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  // Rol + estilista propio: una estilista solo ve/edita SU horario; admin ve todas.
  const [role, setRole] = useState<string>('admin');
  const [myStaffId, setMyStaffId] = useState<string | null>(null);

  // Bloqueos
  const [blocks, setBlocks] = useState<UnavailBlock[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockForm, setBlockForm] = useState({
    staffId: '',
    date: '',
    allDay: true,
    startTime: '08:00',
    endTime: '20:00',
    reason: '',
  });
  const [blockError, setBlockError] = useState('');
  const [addingBlock, setAddingBlock] = useState(false);

  useEffect(() => {
    fetchStaff();
    fetchBlocks();
  }, []);

  useEffect(() => {
    if (selectedStaff) fetchStaffSchedules(selectedStaff);
    else setSchedules(defaultSchedules());
  }, [selectedStaff]);

  async function fetchStaff() {
    let r = 'admin';
    let mine: string | null = null;
    try {
      const u = JSON.parse(localStorage.getItem('admin_user') || '{}');
      r = u.role || 'admin';
      mine = u.staffId || null;
    } catch { /* ignore */ }
    setRole(r);
    setMyStaffId(mine);

    const data = (await adminApi().staff.list().catch(() => [])) as StaffMember[];
    // Permisos: una estilista solo puede ver su propia ficha; admin/super_admin ven todas.
    const list = r === 'estilista' ? data.filter(s => s.id === mine) : data;
    setStaffList(list);
    // Selección por defecto: la propia (estilista) o la primera disponible (admin).
    const def = r === 'estilista' ? (mine || '') : (list[0]?.id || '');
    setSelectedStaff(prev => prev || def);
  }

  async function fetchStaffSchedules(staffId: string) {
    const data = await adminApi().staff.get(staffId).catch(() => null) as { schedules?: { dayOfWeek: number; startTime: string; endTime: string }[] } | null;
    if (data) setSchedules(mergeServerSchedules(data.schedules || []));
  }

  async function fetchBlocks() {
    setLoadingBlocks(true);
    const today = new Date().toISOString().split('T')[0];
    const data = await adminApi().unavailability.list(today).catch(() => []);
    setBlocks(data as UnavailBlock[]);
    setLoadingBlocks(false);
  }

  function updateDay(dayOfWeek: number, field: keyof Schedule, value: string | boolean) {
    setSchedules(prev => prev.map(s =>
      s.dayOfWeek === dayOfWeek ? { ...s, [field]: value } : s
    ));
  }

  async function saveSchedules() {
    if (!selectedStaff) { setSaveMsg('Selecciona una estilista primero'); return; }
    setSaving(true); setSaveMsg('');
    try {
      const enabled = schedules.filter(s => s.enabled).map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }));
      await adminApi().staff.setSchedules(selectedStaff, enabled);
      setSaveMsg('✓ Horario guardado correctamente');
    } catch { setSaveMsg('Error al guardar el horario'); }
    finally { setSaving(false); }
  }

  async function addBlock() {
    setBlockError('');
    if (!blockForm.date) { setBlockError('La fecha es requerida'); return; }
    setAddingBlock(true);
    try {
      const body: Record<string, unknown> = {
        date: blockForm.date,
        reason: blockForm.reason || undefined,
        staffId: blockForm.staffId || undefined,
      };
      if (!blockForm.allDay) {
        body.startTime = blockForm.startTime;
        body.endTime = blockForm.endTime;
      }
      await adminApi().unavailability.create(body);
      setShowBlockModal(false);
      setBlockForm({ staffId: '', date: '', allDay: true, startTime: '08:00', endTime: '20:00', reason: '' });
      fetchBlocks();
    } catch (err) {
      setBlockError(err instanceof Error ? err.message : 'Error al agregar bloqueo');
    } finally { setAddingBlock(false); }
  }

  async function deleteBlock(id: string) {
    await adminApi().unavailability.delete(id);
    fetchBlocks();
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  // Permisos: una estilista solo ve sus bloqueos + los del salón completo (que la afectan).
  const visibleBlocks = role === 'estilista'
    ? blocks.filter(b => b.staffId === myStaffId || b.staffId === null)
    : blocks;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Horarios de Atención</h1>
          <p className="text-gray-500 text-sm mt-1">Gestiona disponibilidad del salón y bloqueos de citas</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setTab('schedules')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === 'schedules' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Clock className="w-4 h-4 inline mr-2" />Horario semanal
          </button>
          <button
            onClick={() => setTab('blocks')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === 'blocks' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <CalendarX className="w-4 h-4 inline mr-2" />Días bloqueados
          </button>
        </div>

        {/* ── TAB: Horario semanal ── */}
        {tab === 'schedules' && (
          <div className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6">
            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                {role === 'estilista' ? 'Tu horario' : 'Estilista'}
              </p>
              {staffList.length === 0 ? (
                <p className="text-sm text-gray-400">No hay estilistas registradas.</p>
              ) : role === 'estilista' ? (
                // Estilista: solo su propia ficha (no puede ver ni elegir otras).
                <span className="inline-flex items-center px-3.5 py-2 rounded-full text-sm font-semibold bg-primary-600 text-white">
                  {staffList[0]?.name}
                </span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {staffList.map(s => {
                    const active = selectedStaff === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedStaff(s.id)}
                        className={`px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
                          active ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {!selectedStaff && staffList.length > 0 && (
              <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-xl">
                Selecciona una estilista para ver y editar su horario semanal
              </div>
            )}

            {selectedStaff && (
              <>
                <p className="text-xs text-gray-400 mb-4">
                  Horario por defecto: Lun–Sáb 08:00–20:00. Desactiva un día para marcarlo como descanso.
                </p>
                <div className="space-y-3">
                  {schedules.map((s) => (
                    <div key={s.dayOfWeek} className={`p-3 sm:p-4 rounded-xl transition-colors ${s.enabled ? 'bg-primary-50' : 'bg-gray-50 opacity-60'}`}>
                      {/* Encabezado de la fila: toggle + día (+ Descanso) */}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          aria-label={`${s.enabled ? 'Desactivar' : 'Activar'} ${DAY_NAMES[s.dayOfWeek]}`}
                          className={`w-10 h-6 rounded-full transition-colors shrink-0 ${s.enabled ? 'bg-primary-600' : 'bg-gray-300'}`}
                          onClick={() => updateDay(s.dayOfWeek, 'enabled', !s.enabled)}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full shadow m-0.5 transition-transform ${s.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                        <span className={`flex-1 text-sm font-semibold ${s.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                          {DAY_NAMES[s.dayOfWeek]}
                        </span>
                        {!s.enabled && <span className="text-xs text-gray-400 italic">Descanso</span>}
                      </div>

                      {/* Selectores de hora: apilados en móvil, lado a lado en escritorio */}
                      {s.enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                            <DateTimePicker
                              mode="time"
                              theme="light"
                              minuteStep={15}
                              minTime="05:00"
                              maxTime="23:00"
                              value={s.startTime}
                              onChange={v => updateDay(s.dayOfWeek, 'startTime', v)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                            <DateTimePicker
                              mode="time"
                              theme="light"
                              minuteStep={15}
                              minTime="05:00"
                              maxTime="23:00"
                              value={s.endTime}
                              onChange={v => updateDay(s.dayOfWeek, 'endTime', v)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-6 pt-5 border-t">
                  {saveMsg && <p className={`text-sm ${saveMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{saveMsg}</p>}
                  <button
                    onClick={saveSchedules}
                    disabled={saving}
                    className="w-full sm:w-auto sm:ml-auto bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : 'Guardar horario'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TAB: Días bloqueados ── */}
        {tab === 'blocks' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <p className="text-sm text-gray-500">
                Bloquea días u horas específicas. Los clientes no podrán reservar en esos horarios.
              </p>
              <button
                onClick={() => {
                  // Estilista: el bloqueo es siempre para sí misma.
                  if (role === 'estilista' && myStaffId) setBlockForm(f => ({ ...f, staffId: myStaffId }));
                  setShowBlockModal(true);
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" /> Agregar bloqueo
              </button>
            </div>

            {loadingBlocks ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-16 animate-pulse" />)}
              </div>
            ) : visibleBlocks.length === 0 ? (
              <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border">
                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No hay bloqueos programados</p>
                <p className="text-xs mt-1">Los clientes pueden reservar en todos los horarios disponibles</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleBlocks.map((b) => (
                  <div key={b.id} className="bg-white rounded-2xl border p-4 flex items-center gap-4">
                    <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                      <CalendarX className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm capitalize">{formatDate(b.date)}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                        <span className="text-xs text-gray-500">
                          {b.startTime && b.endTime
                            ? `🕐 ${b.startTime} – ${b.endTime}`
                            : '🚫 Día completo'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {b.staffId === null ? '👥 Todo el salón' : `✂️ ${b.staff?.name || 'Estilista'}`}
                        </span>
                        {b.reason && <span className="text-xs text-gray-400 italic">{b.reason}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteBlock(b.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                      title="Eliminar bloqueo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal agregar bloqueo */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-lg">Agregar bloqueo</h2>
              <button onClick={() => { setShowBlockModal(false); setBlockError(''); }}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  ¿Para quién? <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:bg-gray-50 disabled:text-gray-500"
                  value={blockForm.staffId}
                  onChange={e => setBlockForm({ ...blockForm, staffId: e.target.value })}
                  disabled={role === 'estilista'}
                >
                  {role !== 'estilista' && <option value="">👥 Todo el salón (cerrado)</option>}
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Fecha <span className="text-red-500">*</span>
                </label>
                <DateTimePicker
                  mode="date"
                  theme="light"
                  minDate={new Date().toISOString().split('T')[0]}
                  value={blockForm.date || null}
                  onChange={d => setBlockForm({ ...blockForm, date: d })}
                />
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer mb-3">
                  <div
                    className={`w-10 h-6 rounded-full transition-colors ${blockForm.allDay ? 'bg-primary-600' : 'bg-gray-300'}`}
                    onClick={() => setBlockForm({ ...blockForm, allDay: !blockForm.allDay })}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow m-0.5 transition-transform ${blockForm.allDay ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Día completo</span>
                </label>

                {!blockForm.allDay && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Desde</label>
                      <DateTimePicker
                        mode="time"
                        theme="light"
                        minuteStep={15}
                        minTime="05:00"
                        maxTime="23:00"
                        value={blockForm.startTime}
                        onChange={v => setBlockForm({ ...blockForm, startTime: v })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                      <DateTimePicker
                        mode="time"
                        theme="light"
                        minuteStep={15}
                        minTime="05:00"
                        maxTime="23:00"
                        value={blockForm.endTime}
                        onChange={v => setBlockForm({ ...blockForm, endTime: v })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Motivo <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text" placeholder="Ej: Feriado, vacaciones, capacitación..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  value={blockForm.reason}
                  onChange={e => setBlockForm({ ...blockForm, reason: e.target.value })}
                />
              </div>

              {blockError && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-xl">{blockError}</p>}
            </div>
            <div className="p-5 border-t flex gap-3">
              <button
                onClick={() => { setShowBlockModal(false); setBlockError(''); }}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={addBlock}
                disabled={addingBlock}
                className="flex-1 bg-primary-600 hover:bg-primary-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {addingBlock ? 'Guardando...' : 'Guardar bloqueo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
