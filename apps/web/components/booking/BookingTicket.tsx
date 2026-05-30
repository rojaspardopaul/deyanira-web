'use client';

import { forwardRef } from 'react';

// Ticket de reserva premium con paleta de marca.
// Fondo: negro #0F0F0F → #181818 con glows decorativos rosa y dorado.
// Logo del salón (con fallback a iniciales).
// Acentos: rosa #FF4FA2 + dorado #D4AF37.

export interface TicketItem {
  name: string;
  staff: string;
  price?: number;
  isAddon?: boolean;
  options?: Array<{ label: string; delta?: number }>;
}

export interface TicketDateGroup {
  date: string;
  startTime: string;
  endTime?: string;
  items: TicketItem[];
}

export interface BookingTicketProps {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  packageName?: string;
  packageLabel?: string;
  dateGroups: TicketDateGroup[];
  totalPen: number;
  atHome?: { address: string; district: string } | null;
  bookingId?: string;
  salonName?: string;
  salonPhone?: string;
  salonWhatsapp?: string;
  salonInstagram?: string;
  logoUrl?: string;
  responsive?: boolean;
}

function fmtFullDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const date = new Date(y, m - 1, d);
  return `${days[date.getDay()]} ${d} de ${months[m - 1]}, ${y}`;
}

const PINK = '#FF4FA2';
const PINK_DK = '#e6368a';
const GOLD = '#D4AF37';
const GOLD_DK = '#a88426';

const BookingTicket = forwardRef<HTMLDivElement, BookingTicketProps>(function BookingTicket(
  {
    customerName, customerPhone, customerEmail,
    packageName, packageLabel,
    dateGroups, totalPen, atHome, bookingId,
    salonName = 'Deyanira Makeup Beauty',
    salonPhone, salonWhatsapp, salonInstagram,
    logoUrl,
    responsive = false,
  },
  ref,
) {
  return (
    <div
      ref={ref}
      style={{
        width: responsive ? '100%' : 600,
        maxWidth: responsive ? 600 : undefined,
        background: 'linear-gradient(180deg, #0F0F0F 0%, #181818 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#fff',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: responsive ? 16 : 0,
      }}
    >
      {/* Glow rosa decorativo (top-right) */}
      <div
        style={{
          position: 'absolute',
          top: -140,
          right: -140,
          width: 380,
          height: 380,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${PINK}33 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />
      {/* Glow dorado decorativo (bottom-left) */}
      <div
        style={{
          position: 'absolute',
          bottom: -120,
          left: -120,
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${GOLD}22 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Header con logo + nombre + badge */}
      <div
        style={{
          padding: '28px 32px 22px',
          position: 'relative',
          zIndex: 1,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={salonName}
                crossOrigin="anonymous"
                style={{ height: 46, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  background: `linear-gradient(135deg, ${PINK}, ${GOLD})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#fff',
                  flexShrink: 0,
                  boxShadow: `0 4px 16px ${PINK}55`,
                }}
              >
                D
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 2,
                  color: GOLD,
                  margin: '3px 0 0 0',
                  textTransform: 'uppercase',
                }}
              >
                Confirmación de reserva
              </p>
            </div>
          </div>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              background: `${GOLD}22`,
              border: `1px solid ${GOLD}55`,
              fontSize: 10,
              fontWeight: 700,
              color: GOLD,
              letterSpacing: 1,
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          >
            ✦ Pendiente
          </div>
        </div>
      </div>

      {/* Cliente */}
      <div style={{ padding: '20px 32px 8px', position: 'relative', zIndex: 1 }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.5,
            color: PINK,
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          👤 Cliente
        </p>
        <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '5px 0 0 0' }}>
          {customerName}
        </p>
        {(customerPhone || customerEmail) && (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: '3px 0 0 0' }}>
            {customerPhone}{customerPhone && customerEmail ? ' · ' : ''}{customerEmail}
          </p>
        )}
      </div>

      {/* Paquete (si aplica) */}
      {packageName && (
        <div style={{ padding: '12px 32px 0', position: 'relative', zIndex: 1 }}>
          <div
            style={{
              background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}0a)`,
              border: `1px solid ${GOLD}44`,
              borderRadius: 14,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 22 }}>👑</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: GOLD }}>
                {packageName}
              </p>
              {packageLabel && (
                <p style={{ fontSize: 11.5, margin: '2px 0 0 0', color: 'rgba(212,175,55,0.7)' }}>
                  {packageLabel}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grupos por fecha */}
      <div style={{ padding: '18px 32px 4px', position: 'relative', zIndex: 1 }}>
        {dateGroups.map((g, gi) => (
          <div
            key={gi}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              padding: '16px 18px',
              marginBottom: 12,
            }}
          >
            {/* Fecha + hora */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: 14,
                gap: 12,
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    color: PINK,
                    textTransform: 'uppercase',
                    margin: 0,
                  }}
                >
                  📅 Fecha
                </p>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    margin: '4px 0 0 0',
                    color: '#fff',
                    textTransform: 'capitalize',
                  }}
                >
                  {fmtFullDate(g.date)}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    color: GOLD,
                    textTransform: 'uppercase',
                    margin: 0,
                  }}
                >
                  🕐 Hora
                </p>
                <p style={{ fontSize: 14, fontWeight: 700, margin: '4px 0 0 0', color: '#fff' }}>
                  {g.startTime}{g.endTime ? ` – ${g.endTime}` : ''}
                </p>
              </div>
            </div>

            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {g.items.map((it, i) => (
                <div key={i}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0, color: '#fff' }}>
                        <span style={{ color: PINK, marginRight: 6 }}>◆</span>
                        {it.name}
                      </p>
                      <p style={{ fontSize: 11.5, margin: '4px 0 0 16px', color: 'rgba(255,255,255,0.5)' }}>
                        Estilista:{' '}
                        <span
                          style={{
                            color: it.staff.startsWith('✦') ? GOLD : 'rgba(255,255,255,0.85)',
                            fontWeight: 600,
                          }}
                        >
                          {it.staff}
                        </span>
                      </p>
                      {it.options && it.options.length > 0 && (
                        <div style={{ marginTop: 6, marginLeft: 16 }}>
                          {it.options.map((o, oi) => (
                            <p
                              key={oi}
                              style={{
                                fontSize: 11,
                                margin: '2px 0',
                                color: 'rgba(255,255,255,0.5)',
                              }}
                            >
                              <span style={{ color: 'rgba(255,255,255,0.35)' }}>↳ </span>
                              {o.label}
                              {o.delta != null && o.delta !== 0 && (
                                <span style={{ color: PINK, fontWeight: 700, marginLeft: 6 }}>
                                  {o.delta > 0 ? '+' : ''}S/ {o.delta.toFixed(2)}
                                </span>
                              )}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    {it.price != null && it.price > 0 && (
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          margin: 0,
                          color: it.isAddon ? PINK : '#fff',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {it.isAddon ? '+' : ''}S/ {it.price.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* A domicilio */}
      {atHome && (
        <div style={{ padding: '0 32px 12px', position: 'relative', zIndex: 1 }}>
          <div
            style={{
              background: 'rgba(255,79,162,0.08)',
              border: `1px solid ${PINK}44`,
              borderRadius: 12,
              padding: '11px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 18 }}>🏠</div>
            <div style={{ flex: 1 }}>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  color: PINK,
                  margin: 0,
                  textTransform: 'uppercase',
                }}
              >
                Servicio a domicilio
              </p>
              <p style={{ fontSize: 12.5, margin: '3px 0 0 0', color: 'rgba(255,255,255,0.85)' }}>
                {atHome.address}, {atHome.district}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Total — card con gradiente rosa→dorado */}
      <div style={{ padding: '8px 32px 16px', position: 'relative', zIndex: 1 }}>
        <div
          style={{
            background: `linear-gradient(135deg, ${PINK} 0%, ${PINK_DK} 60%, ${GOLD_DK} 100%)`,
            color: '#fff',
            borderRadius: 16,
            padding: '18px 22px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: `0 12px 32px ${PINK}44`,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.5,
                margin: 0,
                opacity: 0.95,
                textTransform: 'uppercase',
              }}
            >
              Total a pagar
            </p>
            <p style={{ fontSize: 11, margin: '3px 0 0 0', opacity: 0.85 }}>
              Pago el día de la cita
            </p>
          </div>
          <p style={{ fontSize: 30, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
            S/ {totalPen.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Banner pendiente */}
      <div style={{ padding: '0 32px 14px', position: 'relative', zIndex: 1 }}>
        <div
          style={{
            background: `${GOLD}14`,
            border: `1px solid ${GOLD}33`,
            borderRadius: 10,
            padding: '11px 14px',
            fontSize: 11.5,
            color: GOLD,
            textAlign: 'center',
          }}
        >
          ⏳ <strong>A la espera de confirmación del salón</strong> — Te contactaremos por WhatsApp.
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '14px 32px 22px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
            {(salonWhatsapp || salonPhone) && (
              <p style={{ margin: 0 }}>
                📱{' '}
                <span style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {salonWhatsapp || salonPhone}
                </span>
              </p>
            )}
            {salonInstagram && (
              <p style={{ margin: 0 }}>
                📷{' '}
                <span style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {salonInstagram.replace(/^https?:\/\//, '').replace(/^www\./, '')}
                </span>
              </p>
            )}
          </div>
          {bookingId && (
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '6px 10px',
                fontFamily: 'monospace',
                fontSize: 10,
                color: 'rgba(255,255,255,0.55)',
                letterSpacing: 1,
              }}
            >
              ID #{bookingId.slice(0, 8).toUpperCase()}
            </div>
          )}
        </div>
        <p
          style={{
            fontSize: 9,
            color: 'rgba(255,255,255,0.25)',
            textAlign: 'center',
            margin: '14px 0 0 0',
            letterSpacing: 1.5,
          }}
        >
          deyaniramakeup.pe · Hecho con ♡ en Lima
        </p>
      </div>
    </div>
  );
});

export default BookingTicket;
