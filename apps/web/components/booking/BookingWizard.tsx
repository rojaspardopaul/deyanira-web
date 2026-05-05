'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Check, Clock, ChevronLeft, CalendarDays, Scissors, User } from 'lucide-react';

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { label: 'Servicio', icon: Scissors },
  { label: 'Estilista', icon: User },
  { label: 'Horario', icon: CalendarDays },
  { label: 'Confirmar', icon: Check },
];

export default function BookingWizard() {
  const [step, setStep] = useState<Step>(1);
  const [selectedService, setSelectedService] = useState<Record<string, unknown> | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Record<string, unknown> | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [guestInfo, setGuestInfo] = useState({ name: '', phone: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  async function handleConfirm() {
    if (!selectedService || !selectedStaff || !selectedDate || !selectedSlot) return;
    if (!guestInfo.name.trim() || !guestInfo.phone.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await api.appointments.create({
        serviceId: selectedService.id,
        staffId: selectedStaff.id,
        date: selectedDate,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
        guestName: guestInfo.name,
        guestPhone: guestInfo.phone,
        guestEmail: guestInfo.email,
      }) as Record<string, unknown>;
      setConfirmed(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reservar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  if (confirmed) {
    const whatsappLink = confirmed.whatsappLink as string;
    return (
      <div className="text-center py-10 px-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <Check className="w-10 h-10 text-green-600" strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-display font-bold mb-2">¡Cita reservada!</h2>
        <p className="text-gray-500 mb-1">
          <span className="font-medium">{selectedDate}</span> a las <span className="font-medium">{selectedSlot?.start}</span>
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Te llegará una confirmación por email. Puedes confirmar también por WhatsApp.
        </p>
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary px-8 py-4 text-base shadow-lg shadow-primary-200"
        >
          Confirmar por WhatsApp
        </a>
        <button
          onClick={() => {
            setConfirmed(null); setStep(1);
            setSelectedService(null); setSelectedStaff(null);
            setSelectedDate(''); setSelectedSlot(null);
            setGuestInfo({ name: '', phone: '', email: '' });
          }}
          className="block mx-auto mt-5 text-sm text-gray-400 hover:text-gray-600 underline"
        >
          Hacer otra reserva
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* ── Progress bar ──────────────────────────────── */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between relative">
          {/* Connector line */}
          <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 z-0">
            <div
              className="h-full bg-primary-500 transition-all duration-500"
              style={{ width: `${((step - 1) / 3) * 100}%` }}
            />
          </div>

          {STEPS.map(({ label, icon: Icon }, i) => {
            const n = (i + 1) as Step;
            const isDone = step > n;
            const isActive = step === n;
            return (
              <div key={label} className="flex flex-col items-center gap-1.5 z-10">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isDone
                      ? 'bg-primary-600 text-white'
                      : isActive
                      ? 'bg-white border-2 border-primary-600 text-primary-600'
                      : 'bg-white border-2 border-gray-200 text-gray-400'
                  }`}
                >
                  {isDone ? (
                    <Check className="w-4 h-4" strokeWidth={2.5} />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                </div>
                <span
                  className={`text-[10px] font-semibold hidden sm:block ${
                    isActive ? 'text-primary-600' : isDone ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-center text-xs text-gray-400 mt-3 sm:hidden">
          Paso {step} de 4 — {STEPS[step - 1].label}
        </p>
      </div>

      {/* ── Step content ──────────────────────────────── */}
      <div className="p-4 md:p-6">
        {step === 1 && (
          <ServiceStep onSelect={(s) => { setSelectedService(s); setStep(2); }} />
        )}
        {step === 2 && selectedService && (
          <StaffStep
            serviceId={selectedService.id as string}
            onSelect={(s) => { setSelectedStaff(s); setStep(3); }}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && selectedService && selectedStaff && (
          <SlotStep
            serviceId={selectedService.id as string}
            staffId={selectedStaff.id as string}
            date={selectedDate}
            slot={selectedSlot}
            onDateChange={setSelectedDate}
            onSlotSelect={setSelectedSlot}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <ConfirmStep
            service={selectedService}
            staff={selectedStaff}
            date={selectedDate}
            slot={selectedSlot}
            guestInfo={guestInfo}
            setGuestInfo={setGuestInfo}
            loading={loading}
            error={error}
            onBack={() => setStep(3)}
            onConfirm={handleConfirm}
          />
        )}
      </div>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────

function ServiceStep({ onSelect }: { onSelect: (s: Record<string, unknown>) => void }) {
  const [services, setServices] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.services.list()
      .then(data => setServices(data as Record<string, unknown>[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="skeleton h-20" />)}
    </div>
  );

  return (
    <div>
      <h3 className="font-display font-bold text-xl mb-4">¿Qué servicio deseas?</h3>
      <div className="space-y-2.5">
        {services.map((s) => (
          <button
            key={s.id as string}
            onClick={() => onSelect(s)}
            className="w-full text-left p-4 border-2 border-gray-100 rounded-2xl
                       hover:border-primary-300 hover:bg-primary-50
                       active:scale-[0.98] transition-all duration-150 group"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 group-hover:text-primary-700">
                  {s.name as string}
                </p>
                {s.description && (
                  <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">
                    {s.description as string}
                  </p>
                )}
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-500">{s.duration as number} min</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-xl font-bold text-primary-600">
                  S/ {Number(s.pricePen).toFixed(2)}
                </span>
              </div>
            </div>
          </button>
        ))}
        {services.length === 0 && (
          <p className="text-center text-gray-500 py-10">No hay servicios disponibles.</p>
        )}
      </div>
    </div>
  );
}

function StaffStep({
  serviceId, onSelect, onBack,
}: {
  serviceId: string;
  onSelect: (s: Record<string, unknown>) => void;
  onBack: () => void;
}) {
  const [staff, setStaff] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.staff.byService(serviceId)
      .then(data => setStaff(data as Record<string, unknown>[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [serviceId]);

  if (loading) return (
    <div className="space-y-3">
      {[1, 2].map(i => <div key={i} className="skeleton h-20" />)}
    </div>
  );

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Cambiar servicio
      </button>
      <h3 className="font-display font-bold text-xl mb-4">Elige tu estilista</h3>
      <div className="space-y-2.5">
        {staff.map((s) => (
          <button
            key={s.id as string}
            onClick={() => onSelect(s)}
            className="w-full text-left p-4 border-2 border-gray-100 rounded-2xl
                       hover:border-primary-300 hover:bg-primary-50
                       active:scale-[0.98] transition-all duration-150"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                <span className="text-primary-600 font-bold text-lg">
                  {(s.name as string).charAt(0)}
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{s.name as string}</p>
                <p className="text-sm text-gray-500">{s.role as string}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      {staff.length === 0 && (
        <p className="text-center text-gray-500 py-10">Sin personal disponible para este servicio.</p>
      )}
    </div>
  );
}

function SlotStep({
  serviceId, staffId, date, slot,
  onDateChange, onSlotSelect, onNext, onBack,
}: {
  serviceId: string;
  staffId: string;
  date: string;
  slot: { start: string; end: string } | null;
  onDateChange: (d: string) => void;
  onSlotSelect: (s: { start: string; end: string }) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [slots, setSlots] = useState<{ start: string; end: string }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  async function loadSlots(d: string) {
    onDateChange(d);
    setLoadingSlots(true);
    try {
      const data = await api.appointments.availability(staffId, serviceId, d);
      setSlots(data);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Cambiar estilista
      </button>
      <h3 className="font-display font-bold text-xl mb-5">Elige fecha y hora</h3>

      <div className="mb-5">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha</label>
        <input
          type="date"
          min={today}
          value={date}
          onChange={(e) => loadSlots(e.target.value)}
          className="input"
        />
      </div>

      {loadingSlots && (
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-11 rounded-xl" />
          ))}
        </div>
      )}

      {!loadingSlots && date && slots.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <CalendarDays className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No hay horarios disponibles este día</p>
        </div>
      )}

      {!loadingSlots && slots.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">
            {slots.length} horarios disponibles
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {slots.map((s) => {
              const isSelected = slot?.start === s.start;
              return (
                <button
                  key={s.start}
                  onClick={() => onSlotSelect(s)}
                  className={`py-3 px-2 rounded-xl text-sm font-semibold border-2 transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                      : 'border-gray-200 text-gray-700 hover:border-primary-400 hover:bg-primary-50'
                  }`}
                >
                  {s.start}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button onClick={onBack} className="btn-outline flex-1 py-3.5">Atrás</button>
        <button
          onClick={onNext}
          disabled={!slot}
          className="btn-primary flex-1 py-3.5"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

function ConfirmStep({
  service, staff, date, slot, guestInfo, setGuestInfo,
  loading, error, onBack, onConfirm,
}: {
  service: Record<string, unknown> | null;
  staff: Record<string, unknown> | null;
  date: string;
  slot: { start: string; end: string } | null;
  guestInfo: { name: string; phone: string; email: string };
  setGuestInfo: (v: { name: string; phone: string; email: string }) => void;
  loading: boolean;
  error: string;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const setField = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setGuestInfo({ ...guestInfo, [k]: e.target.value });

  const canSubmit = guestInfo.name.trim() && guestInfo.phone.trim() && !loading;

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Cambiar horario
      </button>

      {/* Resumen de la cita */}
      <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 mb-5">
        <h4 className="font-semibold text-sm text-primary-800 mb-3">Resumen de tu cita</h4>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Servicio</span>
            <span className="font-medium text-gray-900">{service?.name as string}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Estilista</span>
            <span className="font-medium text-gray-900">{staff?.name as string}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Fecha</span>
            <span className="font-medium text-gray-900">{date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Hora</span>
            <span className="font-medium text-gray-900">{slot?.start} – {slot?.end}</span>
          </div>
          <div className="flex justify-between border-t border-primary-200 pt-2 mt-2">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="font-bold text-primary-700 text-base">
              S/ {Number(service?.pricePen ?? 0).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Formulario de contacto */}
      <h3 className="font-display font-bold text-xl mb-4">Tus datos de contacto</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Nombre completo <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="¿Cómo te llamas?"
            required
            value={guestInfo.name}
            onChange={setField('name')}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            WhatsApp / Teléfono <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            placeholder="9XX XXX XXX"
            required
            value={guestInfo.phone}
            onChange={setField('phone')}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Email <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            type="email"
            placeholder="para enviarte la confirmación"
            value={guestInfo.email}
            onChange={setField('email')}
            className="input"
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button onClick={onBack} className="btn-outline flex-1 py-3.5">Atrás</button>
        <button
          onClick={onConfirm}
          disabled={!canSubmit}
          className="btn-primary flex-1 py-3.5"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Reservando...
            </span>
          ) : 'Confirmar cita'}
        </button>
      </div>
    </div>
  );
}
