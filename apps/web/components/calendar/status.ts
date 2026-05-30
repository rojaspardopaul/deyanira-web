import type { AptStatus } from './types';

export const STATUS: Record<AptStatus, {
  label: string;
  bgLight: string;
  bgFull: string;
  text: string;
  border: string;
  dot: string;
}> = {
  pending:   { label: 'Pendiente',  bgLight: 'bg-amber-50',   bgFull: 'bg-amber-400',   text: 'text-amber-700',   border: 'border-l-amber-400',   dot: 'bg-amber-400'   },
  confirmed: { label: 'Confirmada', bgLight: 'bg-blue-50',    bgFull: 'bg-blue-500',    text: 'text-blue-700',    border: 'border-l-blue-500',    dot: 'bg-blue-500'    },
  completed: { label: 'Completada', bgLight: 'bg-emerald-50', bgFull: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-l-emerald-500', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelada',  bgLight: 'bg-red-50',     bgFull: 'bg-red-500',     text: 'text-red-600',     border: 'border-l-red-500',     dot: 'bg-red-500'     },
  no_show:   { label: 'No asistió', bgLight: 'bg-gray-100',   bgFull: 'bg-gray-400',    text: 'text-gray-500',    border: 'border-l-gray-400',    dot: 'bg-gray-400'    },
};

export const ALL_STATUSES = Object.keys(STATUS) as AptStatus[];
