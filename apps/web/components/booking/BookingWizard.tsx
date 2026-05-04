'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Check } from 'lucide-react';

type Step = 1 | 2 | 3 | 4;

const STEPS = ['Servicio', 'Estilista', 'Horario', 'Confirmar'];

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
      setError(err instanceof Error ? err.message : 'Error al reservar');
    } finally {
      setLoading(false);
    }
  }

  if (confirmed) {
    const apt = confirmed.appointment as Record<string, unknown>;
    const whatsappLink = confirmed.whatsappLink as string;
    return (
      <div className="card p-10 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-display font-bold mb-3">¡Cita reservada!</h2>
        <p className="text-gray-600 mb-6">
          Te hemos enviado un email de confirmación. Tu cita está pendiente de confirmación.
        </p>
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary inline-flex gap-2"
        >
          Confirmar por WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div className="card overflow-visible">
      {/* Progress */}
      <div className="flex border-b border-gray-100">
        {STEPS.map((label, i) => {
          const n = (i + 1) as Step;
          const isActive = step === n;
          const isDone = step > n;
          return (
            <div key={label} className="flex-1 text-center py-4">
              <span className={`text-xs font-semibold uppercase tracking-wider ${
                isActive ? 'text-primary-600' : isDone ? 'text-green-600' : 'text-gray-400'
              }`}>
                {isDone ? '✓ ' : `${n}. `}{label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="p-6">
        {/* Paso 1: Seleccionar servicio */}
        {step === 1 && (
          <ServiceStep
            onSelect={(s) => { setSelectedService(s); setStep(2); }}
          />
        )}

        {/* Paso 2: Seleccionar estilista */}
        {step === 2 && selectedService && (
          <StaffStep
            serviceId={selectedService.id as string}
            onSelect={(s) => { setSelectedStaff(s); setStep(3); }}
            onBack={() => setStep(1)}
          />
        )}

        {/* Paso 3: Seleccionar fecha y hora */}
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

        {/* Paso 4: Confirmar */}
        {step === 4 && (
          <div className="space-y-6">
            <h3 className="font-semibold text-lg">Tus datos de contacto</h3>
            <div className="grid gap-4">
              {[
                { key: 'name', label: 'Nombre completo', type: 'text', required: true },
                { key: 'phone', label: 'Teléfono / WhatsApp', type: 'tel', required: true },
                { key: 'email', label: 'Email (opcional)', type: 'email', required: false },
              ].map(({ key, label, type, required }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type={type}
                    required={required}
                    value={guestInfo[key as keyof typeof guestInfo]}
                    onChange={(e) => setGuestInfo(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ))}
            </div>

            {/* Resumen */}
            <div className="bg-primary-50 rounded-xl p-4 text-sm space-y-2">
              <p><strong>Servicio:</strong> {selectedService?.name as string}</p>
              <p><strong>Estilista:</strong> {selectedStaff?.name as string}</p>
              <p><strong>Fecha:</strong> {selectedDate}</p>
              <p><strong>Hora:</strong> {selectedSlot?.start} – {selectedSlot?.end}</p>
              <p><strong>Total:</strong> S/ {(selectedService?.pricePen as number) ?? ''}</p>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="btn-outline flex-1">
                Atrás
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || !guestInfo.name || !guestInfo.phone}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {loading ? 'Reservando...' : 'Confirmar cita'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-componentes de cada paso ──────────────────────────

function ServiceStep({ onSelect }: { onSelect: (s: Record<string, unknown>) => void }) {
  const [services, setServices] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useState(() => {
    api.services.list().then((data) => {
      setServices(data as Record<string, unknown>[]);
      setLoading(false);
    });
  });

  if (loading) return <p className="text-center text-gray-500 py-8">Cargando servicios...</p>;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg mb-4">¿Qué servicio deseas?</h3>
      {services.map((s) => (
        <button
          key={s.id as string}
          onClick={() => onSelect(s)}
          className="w-full text-left p-4 border border-gray-200 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition-colors"
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">{s.name as string}</p>
              <p className="text-sm text-gray-500">{s.duration as number} min</p>
            </div>
            <span className="font-bold text-primary-600">S/ {Number(s.pricePen).toFixed(2)}</span>
          </div>
        </button>
      ))}
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

  useState(() => {
    api.staff.byService(serviceId).then((data) => setStaff(data as Record<string, unknown>[]));
  });

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg mb-4">Elige tu estilista</h3>
      {staff.map((s) => (
        <button
          key={s.id as string}
          onClick={() => onSelect(s)}
          className="w-full text-left p-4 border border-gray-200 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition-colors"
        >
          <p className="font-medium">{s.name as string}</p>
          <p className="text-sm text-gray-500">{s.role as string}</p>
        </button>
      ))}
      <button onClick={onBack} className="btn-outline w-full mt-4">Atrás</button>
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

  async function loadSlots(d: string) {
    onDateChange(d);
    const data = await api.appointments.availability(staffId, serviceId, d);
    setSlots(data);
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-5">
      <h3 className="font-semibold text-lg">Elige fecha y hora</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
        <input
          type="date"
          min={today}
          value={date}
          onChange={(e) => loadSlots(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {date && slots.length === 0 && (
        <p className="text-center text-gray-500 py-4">No hay horarios disponibles este día</p>
      )}

      {slots.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Horarios disponibles</p>
          <div className="grid grid-cols-3 gap-2">
            {slots.map((s) => (
              <button
                key={s.start}
                onClick={() => onSlotSelect(s)}
                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  slot?.start === s.start
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50'
                }`}
              >
                {s.start}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="btn-outline flex-1">Atrás</button>
        <button
          onClick={onNext}
          disabled={!slot}
          className="btn-primary flex-1 disabled:opacity-50"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
