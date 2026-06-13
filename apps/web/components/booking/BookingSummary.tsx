'use client';

import { fmtRange12 } from '@/lib/time';

// Resumen simple de la reserva para mostrar en pantalla tras confirmar.
// Sin logo, sin decoraciones — solo los datos clave.
// El diseño "premium con logo" vive en <BookingTicket /> y se usa solo
// para generar la imagen que se envía por WhatsApp.

export interface SummaryItem {
  name: string;
  staff: string;
  price?: number;
  isAddon?: boolean;
  /** Servicio incluido en el paquete: muestra "Incluido en el paquete" sin monto. */
  isIncluded?: boolean;
  options?: Array<{ label: string; delta?: number }>;
}

export interface SummaryDateGroup {
  date: string;
  startTime: string;
  endTime?: string;
  items: SummaryItem[];
}

interface Props {
  customerName: string;
  packageName?: string;
  packageLabel?: string;
  /** Precio del paquete: se muestra en el bloque del paquete, no por servicio. */
  packagePricePen?: number;
  dateGroups: SummaryDateGroup[];
  totalPen: number;
  atHome?: { address: string; district: string } | null;
}

function fmtFullDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const days = ['dom','lun','mar','mié','jue','vie','sáb'];
  const date = new Date(y, m - 1, d);
  return `${days[date.getDay()]} ${d} ${months[m - 1]} ${y}`;
}

export default function BookingSummary({
  customerName, packageName, packageLabel, packagePricePen,
  dateGroups, totalPen, atHome,
}: Props) {
  return (
    <div
      className="rounded-2xl mx-auto"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        maxWidth: 560,
      }}
    >
      {/* Cliente */}
      <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#FF4FA2' }}>
          Cliente
        </p>
        <p className="text-base font-bold text-white mt-1">{customerName}</p>
      </div>

      {/* Paquete (si aplica) */}
      {packageName && (
        <div className="px-5 py-3 border-b flex items-start justify-between gap-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#D4AF37' }}>
              Paquete
            </p>
            <p className="text-sm font-semibold text-white mt-1">{packageName}</p>
            {packageLabel && (
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{packageLabel}</p>
            )}
          </div>
          {packagePricePen != null && (
            <p className="text-sm font-bold shrink-0 whitespace-nowrap mt-4" style={{ color: '#D4AF37' }}>
              S/ {Number(packagePricePen).toFixed(2)}
            </p>
          )}
        </div>
      )}

      {/* Fechas + items */}
      {dateGroups.map((g, gi) => (
        <div
          key={gi}
          className="px-5 py-4 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-baseline justify-between mb-3 gap-3">
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#FF4FA2' }}>
                Fecha
              </p>
              <p className="text-sm font-bold text-white capitalize mt-0.5">{fmtFullDate(g.date)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#D4AF37' }}>
                Hora
              </p>
              <p className="text-sm font-bold text-white mt-0.5">
                {fmtRange12(g.startTime, g.endTime)}
              </p>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            {g.items.map((it, i) => (
              <div key={i}>
                <div className="flex justify-between items-start gap-3">
                  <p className="text-sm text-white font-medium flex-1 min-w-0">
                    <span style={{ color: '#FF4FA2', marginRight: 6 }}>◆</span>
                    {it.name}
                  </p>
                  {it.isIncluded ? (
                    <p className="text-[11px] italic shrink-0 whitespace-nowrap mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      Incluido en el paquete
                    </p>
                  ) : it.price != null && it.price > 0 && (
                    <p className="text-sm font-bold shrink-0 whitespace-nowrap"
                      style={{ color: it.isAddon ? '#FF4FA2' : '#fff' }}>
                      {it.isAddon ? '+' : ''}S/ {it.price.toFixed(2)}
                    </p>
                  )}
                </div>
                <p className="text-xs mt-1 ml-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Estilista:{' '}
                  <span style={{ color: it.staff.startsWith('✦') ? '#D4AF37' : 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                    {it.staff}
                  </span>
                </p>
                {it.options && it.options.length > 0 && (
                  <div className="mt-1 ml-4 space-y-0.5">
                    {it.options.map((o, oi) => (
                      <p key={oi} className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        ↳ {o.label}
                        {o.delta != null && o.delta !== 0 && (
                          <span className="ml-1.5 font-semibold" style={{ color: '#FF4FA2' }}>
                            {o.delta > 0 ? '+' : ''}S/ {o.delta.toFixed(2)}
                          </span>
                        )}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* A domicilio */}
      {atHome && (
        <div className="px-5 py-3 border-b text-xs" style={{ borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.75)' }}>
          <span style={{ color: '#FF4FA2', fontWeight: 700 }}>🏠 A domicilio:</span>{' '}
          {atHome.address}, {atHome.district}
        </div>
      )}

      {/* Total */}
      <div className="px-5 py-4 flex items-center justify-between">
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Total a pagar
        </span>
        <span className="text-2xl font-bold" style={{ color: '#D4AF37' }}>
          S/ {totalPen.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
