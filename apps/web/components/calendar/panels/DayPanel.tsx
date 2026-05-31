'use client';

import { Plus, Clock, User, Scissors, Calendar } from 'lucide-react';
import { STATUS } from '../status';
import { isPastDate, isPastDateTime, clientName } from '../utils/date';
import { fmtTime12 } from '../utils/time';
import { MONTH_NAMES, DAY_NAMES_FULL } from '../constants';
import type { Appointment } from '../types';

type DayPanelProps = {
  selectedDate: string;
  selectedTime: string | null;
  dayApts: Appointment[];
  adminRole: string;
  onCreate: () => void;
  onAptClick: (apt: Appointment) => void;
  onClearTime: () => void;
};

export function DayPanel({
  selectedDate, selectedTime, dayApts, adminRole, onCreate, onAptClick, onClearTime,
}: DayPanelProps) {
  const d = new Date(selectedDate + 'T12:00:00');
  const dow = d.getDay();
  const dayIdx = dow === 0 ? 6 : dow - 1;
  const isPast = isPastDate(selectedDate);
  const isPastTimeBool = selectedTime ? isPastDateTime(selectedDate, selectedTime) : false;
  const canCreate = adminRole !== 'estilista' && !isPast && !isPastTimeBool;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{DAY_NAMES_FULL[dayIdx]}</p>
        <p className="text-lg font-bold text-gray-900">{d.getDate()} {MONTH_NAMES[d.getMonth()]}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {dayApts.length} cita{dayApts.length !== 1 ? 's' : ''}{isPast ? ' · día pasado' : ''}
        </p>
      </div>

      {adminRole !== 'estilista' && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-br from-amber-50 to-yellow-50">
          {selectedTime && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Clock className="w-3 h-3" /> <strong className="text-gold-600">{selectedTime}</strong>
              </span>
              <button onClick={onClearTime} className="text-xs text-gray-400 hover:text-gray-700">Limpiar</button>
            </div>
          )}
          <button
            onClick={onCreate}
            disabled={!canCreate}
            className={`w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
              canCreate
                ? 'bg-gold-400 hover:bg-gold-500 text-gray-900 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Plus className="w-4 h-4" />
            {selectedTime ? `Crear cita a las ${selectedTime}` : 'Crear nueva cita'}
          </button>
          {isPast && <p className="text-[11px] text-amber-700 text-center mt-1.5">No se pueden crear citas en días pasados</p>}
          {!isPast && isPastTimeBool && <p className="text-[11px] text-amber-700 text-center mt-1.5">Esa hora ya pasó</p>}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {dayApts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <Calendar className="w-7 h-7 mb-2 opacity-40" />
            <p className="text-sm">Sin citas este día</p>
            {!isPast && adminRole !== 'estilista' && (
              <p className="text-[11px] text-gray-400 mt-1">Toca una hora para crear una</p>
            )}
          </div>
        ) : (
          dayApts.map(apt => {
            const cfg = STATUS[apt.status];
            return (
              <button
                key={apt.id}
                onClick={() => onAptClick(apt)}
                className="w-full text-left border border-gray-100 rounded-xl p-3 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-gray-900 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-gray-400" />
                    {fmtTime12(apt.startTime)}&ndash;{fmtTime12(apt.endTime)}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bgLight} ${cfg.text} flex items-center gap-1`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1">
                  <User className="w-3 h-3 text-gray-400" />{clientName(apt)}
                </p>
                <p className="text-xs text-gray-600 truncate flex items-center gap-1">
                  <Scissors className="w-3 h-3 text-gray-400" />{apt.service.name}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[11px] text-gray-500 truncate">
                    {apt.staff ? apt.staff.name : <span className="text-purple-500">Sin asignar</span>}
                  </p>
                  <p className="text-xs font-bold text-gray-700">S/ {Number(apt.totalPen).toFixed(0)}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
