'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { useLoading } from '@/lib/loading';
import { Calendar, ChevronLeft, Clock, MessageCircle } from 'lucide-react';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Solicitada', color: 'bg-yellow-100 text-yellow-700' },
  confirmed:   { label: 'Confirmada', color: 'bg-green-100 text-green-700' },
  in_progress: { label: 'En curso',   color: 'bg-teal-100 text-teal-700' },
  completed:   { label: 'Atendida',   color: 'bg-blue-100 text-blue-700' },
  cancelled:   { label: 'Cancelada',  color: 'bg-red-100 text-red-600' },
  no_show:     { label: 'No asistió', color: 'bg-gray-100 text-gray-500' },
};

export default function MisCitasPage() {
  const router = useRouter();
  const { wrap } = useLoading();
  const [appointments, setAppointments] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    const supabase = createClient();
    wrap(
      supabase.auth.getUser().then(async ({ data }) => {
        if (!data.user) { router.push('/login'); return; }
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        if (token) {
          const apts = await api.appointments.mine(token).catch(() => []);
          setAppointments(apts as Record<string, unknown>[]);
        }
      })
    );
  }, [router, wrap]);

  const upcoming = appointments.filter(
    (a) => a.status === 'pending' || a.status === 'confirmed' || a.status === 'in_progress'
  );
  const past = appointments.filter(
    (a) => a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show'
  );

  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-24 md:pb-10">
      <div className="max-w-2xl mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <Link href="/mi-cuenta" className="text-gray-500 hover:text-primary-600">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display font-bold text-xl text-gray-900">Mis citas</h1>
        </div>

        {appointments.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">Todavía no tienes citas</p>
            <Link href="/reservar"
              className="inline-flex items-center gap-2 bg-primary-600 text-white font-semibold px-6 py-3 rounded-full text-sm hover:bg-primary-500 transition-all"
              style={{ boxShadow: '0 4px 20px rgba(219,39,119,0.35)' }}
            >
              Reservar mi primera cita
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {upcoming.length > 0 && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Próximas</h2>
                <div className="space-y-3">
                  {upcoming.map((apt) => (
                    <AppointmentCard key={apt.id as string} apt={apt} />
                  ))}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Historial</h2>
                <div className="space-y-3">
                  {past.map((apt) => (
                    <AppointmentCard key={apt.id as string} apt={apt} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Link href="/reservar"
          className="mt-6 flex items-center justify-center gap-2 w-full py-3.5 bg-primary-600 text-white font-semibold rounded-full text-sm hover:bg-primary-500 transition-all"
          style={{ boxShadow: '0 4px 20px rgba(219,39,119,0.35)' }}
        >
          + Nueva cita
        </Link>
      </div>
    </div>
  );
}

function AppointmentCard({ apt }: { apt: Record<string, unknown> }) {
  const s = STATUS_LABEL[apt.status as string] || { label: apt.status as string, color: 'bg-gray-100 text-gray-600' };
  const isUpcoming = apt.status === 'pending' || apt.status === 'confirmed';

  const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '51999999999';
  const serviceName = (apt.service as Record<string, unknown>)?.name as string;
  const dateStr = apt.date
    ? new Date(apt.date as string).toLocaleDateString('es-PE', {
        weekday: 'long', day: 'numeric', month: 'long',
        timeZone: 'America/Lima',
      })
    : '';
  const waText = encodeURIComponent(
    `Hola, quisiera cancelar mi cita de ${serviceName} el ${dateStr} a las ${apt.startTime}.`
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-bold text-gray-900">{serviceName}</p>
          <p className="text-sm text-gray-500">
            con {((apt.staff as Record<string, unknown>)?.name as string) || '✦ Estilista de turno'}
          </p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${s.color}`}>
          {s.label}
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          {new Date(apt.date as string).toLocaleDateString('es-PE', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
            timeZone: 'America/Lima',
          })}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          {apt.startTime as string}
        </span>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <span className="font-semibold text-primary-600">S/ {Number(apt.totalPen).toFixed(2)}</span>
        {isUpcoming && (
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Cancelar por WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
