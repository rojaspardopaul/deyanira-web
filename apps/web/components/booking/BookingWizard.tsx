'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { useLoading } from '@/lib/loading';
import {
  LogIn, UserPlus, Phone, CalendarCheck, Timer,
} from 'lucide-react';
import BookingTicket, { type TicketDateGroup, type TicketItem } from '@/components/booking/BookingTicket';
import Turnstile from '@/components/ui/Turnstile';
import BookingSummary from '@/components/booking/BookingSummary';
import {
  type Selections, type ModifierGroup,
} from '@/lib/pricing';
import type {
  Service, Staff, Category, Slot, GuestInfo, Step, AuthUser, Assignment,
} from '@/features/appointments/types/booking.types';
import {
  effectivePricing, totalWithPackage,
  generateTicketBlob, blobToDataUrl, tryNativeShareWithFile, atHomeExtra,
  computeDisplayEnd,
} from '@/features/appointments/utils/booking';

// ── Types ──────────────────────────────────────────────────
// Tipos en @/features/appointments/types/booking.types (importados arriba).

// ── Helpers ─────────────────────────────────────────────────
// Helpers en @/features/appointments/utils/booking (importados arriba).


import {
  BOOKING_TIMER_SEC,
  StepBar,
  PackageBanner,
  PackageCard,
  type PackageBookable,
  ServiceStep,
  StaffAssignmentStep,
  SlotStep,
  ConfirmStep,
} from '@/features/appointments/components/BookingSteps';

export default function BookingWizard({
  initialServiceId,
  initialCategorySlug,
  initialPackageId,
  initialTrialEnabled,
}: {
  initialServiceId?: string;
  initialCategorySlug?: string;
  initialPackageId?: string;
  initialTrialEnabled?: boolean;
}) {
  const { show: showLoader, hide: hideLoader, wrap } = useLoading();
  const [authUser, setAuthUser]       = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const router = useRouter();
  const [step, setStep]                         = useState<Step>(1);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [assignments, setAssignments]           = useState<Assignment[]>([]);
  const [selectedDate, setSelectedDate]         = useState('');
  const [selectedSlot, setSelectedSlot]         = useState<Slot | null>(null);
  const [guestInfo, setGuestInfo]               = useState<GuestInfo>({ name: '', phone: '', email: '' });
  const [atHome, setAtHome]                     = useState(false);
  const [atHomeAddress, setAtHomeAddress]       = useState('');
  const [atHomeDistrict, setAtHomeDistrict]     = useState('Cieneguilla');
  const [atHomeEnabled, setAtHomeEnabled]       = useState(false);
  const [loading, setLoading]                   = useState(false);
  const [confirmed, setConfirmed]               = useState<Record<string, unknown> | null>(null);
  const [error, setError]                       = useState('');
  // Anti-bot: token Turnstile + honeypot (campo señuelo que un humano nunca rellena)
  const [turnstileToken, setTurnstileToken]     = useState('');
  const [honeypot, setHoneypot]                 = useState('');

  // Paquete preseleccionado (cuando se llega desde /servicios/[evento])
  const [packageInfo, setPackageInfo] = useState<PackageBookable | null>(null);
  // Toggle "Con prueba de maquillaje" del paquete (puede venir activado por ?trial=1)
  const [trialEnabled, setTrialEnabled] = useState(!!initialTrialEnabled);
  // Fechas adicionales para servicios con anticipación obligatoria.
  // Key: número de días antes (1, 15…), Value: fecha YYYY-MM-DD y hora.
  const [advanceDates, setAdvanceDates] = useState<Record<number, { date: string; startTime?: string }>>({});
  // Selecciones de modificadores dinámicos por servicio.
  // Key: serviceId, Value: { [groupId]: { optionIds?, value?, quantity? } }
  const [modifierSelections, setModifierSelections] = useState<Record<string, Selections>>({});

  // Compartir reserva como imagen por WhatsApp
  const ticketRef = useRef<HTMLDivElement | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [whatsappError, setWhatsappError] = useState('');
  // Datos del salón para el ticket (nombre, logo, contacto)
  const [salonInfo, setSalonInfo] = useState<{
    name?: string; logoUrl?: string; logoDarkUrl?: string;
    whatsapp?: string; phone?: string; instagram?: string;
  }>({});
  // Logo pre-cargado como data:URL para que html-to-image no falle por CORS
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');

  // Lista de service IDs a preseleccionar (sólo los del paquete; +trial si activado)
  const initialServiceIds = packageInfo
    ? Array.from(new Set([
        ...packageInfo.bookableServices.map((s) => s.serviceId),
        ...(trialEnabled && packageInfo.trialAddon ? [packageInfo.trialAddon.serviceId] : []),
      ]))
    : undefined;

  // Timer duration from settings (fallback: 10 min)
  const [bookingTimerSec, setBookingTimerSec] = useState(BOOKING_TIMER_SEC);
  // Tracks which assignment combo we last loaded slots for (avoids resetting date/slot on back-forward)
  const [lastSlotKey, setLastSlotKey] = useState('');

  // Booking timer
  const [timerLeft, setTimerLeft]   = useState<number | null>(null);
  const timerRef                     = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scroll-to-top on step change
  const wizardTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.settings.public()
      .then((s) => {
        const sett = s as Record<string, unknown>;
        if (sett.atHomeEnabled) setAtHomeEnabled(true);
        if (sett.bookingTimerSeconds && Number(sett.bookingTimerSeconds) > 0) {
          setBookingTimerSec(Number(sett.bookingTimerSeconds));
        }
        setSalonInfo({
          name: sett.salonName as string | undefined,
          logoUrl: sett.logoUrl as string | undefined,
          logoDarkUrl: sett.logoDarkUrl as string | undefined,
          whatsapp: sett.whatsapp as string | undefined,
          phone: sett.phone as string | undefined,
          instagram: sett.instagramUrl as string | undefined,
        });
      })
      .catch(() => {});
  }, []);

  // Pre-fetch del logo a data:URL para que html-to-image no falle por CORS al
  // capturar imágenes cross-origin. Si Cloudinary no envía el header CORS,
  // toBlob() lanza "tainted canvas" y rompe la generación de la imagen.
  //
  // Prioridad de logo:
  //   1. salonInfo.logoDarkUrl (subido desde /admin/configuracion)
  //   2. salonInfo.logoUrl (subido desde /admin/configuracion)
  //   3. /logo-dark.png (fallback estático en public/)
  useEffect(() => {
    const url = salonInfo.logoDarkUrl || salonInfo.logoUrl || '/logo-dark.png';
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) return;
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onload = () => {
          if (!cancelled && typeof reader.result === 'string') {
            setLogoDataUrl(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        // Si falla, el ticket usará el fallback "D"
        console.warn('No se pudo pre-cargar el logo para el ticket:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [salonInfo.logoDarkUrl, salonInfo.logoUrl]);

  // Fetch del paquete cuando llegamos con ?package=<id>
  useEffect(() => {
    if (!initialPackageId) return;
    api.eventTypes
      .package(initialPackageId)
      .then((p) => setPackageInfo(p as PackageBookable))
      .catch(() => {});
  }, [initialPackageId]);

  // Trial addon: sincroniza `selectedServices` con el toggle del trial.
  // El servicio "Prueba de maquillaje" puede estar inactivo (no aparece en el catálogo público),
  // así que lo inyectamos como Service sintético desde packageInfo.trialAddon.
  useEffect(() => {
    if (!packageInfo?.trialAddon) return;
    const ta = packageInfo.trialAddon;
    setSelectedServices(prev => {
      const has = prev.some(s => s.id === ta.serviceId);
      if (trialEnabled && !has) {
        return [...prev, {
          id: ta.serviceId,
          name: ta.name,
          duration: ta.duration,
          pricePen: 0, // el extra se factura por separado vía addonPricePen
        } as Service];
      }
      if (!trialEnabled && has) {
        // Limpiar también su asignación
        setAssignments(pa => pa.filter(a => a.service.id !== ta.serviceId));
        return prev.filter(s => s.id !== ta.serviceId);
      }
      return prev;
    });
  }, [trialEnabled, packageInfo]);

  useEffect(() => {
    showLoader();
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const meta  = session.user.user_metadata;
        const token = session.access_token;
        setAuthUser({
          id: session.user.id,
          email: session.user.email,
          name: meta?.name || meta?.full_name || '',
          token,
        });
        setGuestInfo(prev => ({
          name:  prev.name  || meta?.name || meta?.full_name || '',
          phone: prev.phone || '',
          email: prev.email || session.user.email || '',
        }));
        api.customers.me(token).then(profile => {
          setGuestInfo(prev => ({
            name:  prev.name  || profile.name  || '',
            phone: prev.phone || profile.phone || '',
            email: prev.email,
          }));
        }).catch(() => {});
      }
      setAuthChecked(true);
      hideLoader();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to top of wizard on step change
  useEffect(() => {
    if (wizardTopRef.current) {
      wizardTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [step]);

  // Scroll to top when confirmation screen appears
  useEffect(() => {
    if (confirmed) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [confirmed]);

  // Booking timer: start when entering step 4, clear otherwise
  useEffect(() => {
    if (step === 4 && selectedSlot) {
      setTimerLeft(bookingTimerSec);
      timerRef.current = setInterval(() => {
        setTimerLeft(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (step !== 4) setTimerLeft(null);
    }
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Timer expired → go back to slot selection
  useEffect(() => {
    if (timerLeft === 0) {
      setSelectedSlot(null);
      setStep(3);
      setError('El tiempo para completar la reserva expiró. Por favor selecciona otro horario.');
    }
  }, [timerLeft]);

  const toggleService = useCallback((s: Service) => {
    setSelectedServices(prev => {
      const idx = prev.findIndex(x => x.id === s.id);
      if (idx >= 0) {
        setAssignments(pa => pa.filter(a => a.service.id !== s.id));
        return prev.filter((_, i) => i !== idx);
      }
      return [...prev, s];
    });
  }, []);

  function handleAssign(service: Service, staff: Staff | null, onDuty: boolean) {
    setAssignments(prev => [
      ...prev.filter(a => a.service.id !== service.id),
      { service, staff, onDuty },
    ]);
  }

  function goToStep(n: Step) { if (n < step) setStep(n); }

  function clearPackage() {
    setPackageInfo(null);
    setSelectedServices([]);
    setAssignments([]);
    setTrialEnabled(false);
  }

  async function handleConfirm() {
    if (assignments.length === 0 || !selectedDate || !selectedSlot || !authUser) return;
    setLoading(true); setError('');
    showLoader();
    try {
      // Construimos los items para el endpoint batch.
      // Para cada servicio, calculamos su fecha de acuerdo a daysBeforeMain.
      type BatchItem = {
        serviceId: string;
        staffId?: string | null;
        onDuty: boolean;
        date?: string;
        startTime?: string;
        addonPricePen?: number;
      };
      const items: BatchItem[] = [];

      // Helper para obtener fecha del item: si daysBeforeMain > 0, usa advanceDates[N]; sino selectedDate
      const dateFor = (daysBeforeMain?: number | null) => {
        if (!daysBeforeMain || daysBeforeMain <= 0) return undefined;
        return advanceDates[daysBeforeMain]?.date;
      };
      const startFor = (daysBeforeMain?: number | null) => {
        if (!daysBeforeMain || daysBeforeMain <= 0) return undefined;
        return advanceDates[daysBeforeMain]?.startTime;
      };

      if (packageInfo) {
        for (const bs of packageInfo.bookableServices) {
          const asgn = assignments.find(a => a.service.id === bs.serviceId);
          items.push({
            serviceId: bs.serviceId,
            staffId: asgn?.onDuty ? null : asgn?.staff?.id || null,
            onDuty: !!asgn?.onDuty || !asgn?.staff,
            date: dateFor(bs.daysBeforeMain ?? null),
            startTime: startFor(bs.daysBeforeMain ?? null),
          });
        }
        // Trial addon (si está activado): se añade como item con su serviceId
        if (trialEnabled && packageInfo.trialAddon) {
          const ta = packageInfo.trialAddon;
          const asgn = assignments.find(a => a.service.id === ta.serviceId);
          items.push({
            serviceId: ta.serviceId,
            staffId: asgn?.onDuty ? null : asgn?.staff?.id || null,
            onDuty: !!asgn?.onDuty || !asgn?.staff,
            date: dateFor(ta.daysBeforeMain ?? null),
            startTime: startFor(ta.daysBeforeMain ?? null),
            addonPricePen: ta.extraPricePen,
          });
        }
      }

      // Extras: servicios en assignments que no formen parte del paquete ni del trial
      const skipIds = new Set([
        ...(packageInfo?.bookableServices.map(b => b.serviceId) || []),
        ...(trialEnabled && packageInfo?.trialAddon ? [packageInfo.trialAddon.serviceId] : []),
      ]);
      for (const asgn of assignments) {
        if (skipIds.has(asgn.service.id)) continue;
        const sel = modifierSelections[asgn.service.id];
        items.push({
          serviceId: asgn.service.id,
          staffId: asgn.onDuty ? null : asgn.staff?.id || null,
          onDuty: asgn.onDuty || !asgn.staff,
          ...(sel && Object.keys(sel).length > 0 ? { modifierSelections: sel } : {}),
        } as typeof items[number] & { modifierSelections?: Selections });
      }

      const result = await api.appointments.batch({
        packageId: packageInfo?.id || null,
        items,
        date: selectedDate,
        startTime: selectedSlot.start,
        guestName: guestInfo.name,
        guestPhone: guestInfo.phone,
        guestEmail: guestInfo.email || authUser.email,
        atHome,
        atHomeAddress: atHome ? atHomeAddress : undefined,
        atHomeDistrict: atHome ? atHomeDistrict : undefined,
        turnstileToken: turnstileToken || undefined,
        website: honeypot || undefined,
      }, authUser.token);

      api.customers.updateMe(
        { name: guestInfo.name, phone: guestInfo.phone },
        authUser.token,
      ).catch(() => {});

      // Si la reserva (paquete) requiere adelanto, vamos al paso de pago.
      const r = result as { appointments?: Array<{ id: string }>; requiresDeposit?: boolean; bookingPaymentId?: string | null };
      if (r?.requiresDeposit && r?.bookingPaymentId) {
        router.push(`/reservar/pago?bp=${r.bookingPaymentId}`);
        return;
      }

      // Guardamos la respuesta completa para tener el ID de la primera cita
      // (usado en el ticket de WhatsApp).
      const firstAppt = r?.appointments?.[0];
      setConfirmed({ ok: true, id: firstAppt?.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reservar. Intenta de nuevo.');
    } finally {
      setLoading(false);
      hideLoader();
    }
  }

  function handleReset() {
    setConfirmed(null); setStep(1);
    setSelectedServices([]); setAssignments([]);
    setSelectedDate(''); setSelectedSlot(null);
    setAtHome(false); setAtHomeAddress('');
    setTimerLeft(null);
  }

  if (!authChecked) return null;

  if (!authUser) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'linear-gradient(135deg, rgba(255,79,162,0.15), rgba(212,175,55,0.1))', border: '1px solid rgba(255,79,162,0.2)' }}>
          <LogIn className="w-7 h-7" style={{ color: '#FF4FA2' }} />
        </div>
        <h2 className="font-display font-bold italic text-2xl text-white mb-2">Inicia sesión para reservar</h2>
        <p className="text-sm mb-8 max-w-xs mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Necesitas una cuenta para reservar citas. Es gratis y te toma menos de un minuto.
        </p>
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <Link href="/login?redirect=/reservar"
            className="flex items-center justify-center gap-2 w-full py-3.5 font-bold rounded-full text-sm text-white transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #FF4FA2, #e6368a)', boxShadow: '0 4px 20px rgba(255,79,162,0.4)' }}>
            <LogIn className="w-4 h-4" /> Iniciar sesión
          </Link>
          <Link href="/registro?redirect=/reservar"
            className="flex items-center justify-center gap-2 w-full py-3.5 font-bold rounded-full text-sm transition-all border"
            style={{ color: '#FF4FA2', borderColor: 'rgba(255,79,162,0.35)', background: 'rgba(255,79,162,0.06)' }}>
            <UserPlus className="w-4 h-4" /> Crear cuenta gratis
          </Link>
        </div>
        <p className="text-xs mt-6" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Al crear una cuenta podrás ver el historial de tus citas.
        </p>
      </div>
    );
  }

  // ── Confirmation screen ─────────────────────────────────
  if (confirmed) {
    const trialExtra = (trialEnabled && packageInfo?.trialAddon) ? packageInfo.trialAddon.extraPricePen : 0;
    const totalAmt = totalWithPackage(selectedServices, packageInfo, modifierSelections) + trialExtra + (atHome ? atHomeExtra(atHomeDistrict) : 0);
    const endTime  = selectedSlot ? computeDisplayEnd(assignments, selectedSlot.start, modifierSelections) : '';
    const hasOnDuty = assignments.some(a => a.onDuty);

    // Agrupa los servicios por fecha. Cada assignment va al grupo central o a un grupo
    // anticipado según su daysBeforeMain efectivo. El trial usa packageInfo.trialAddon.daysBeforeMain.
    type DateItem = { name: string; staff: string; price: number; isAddon?: boolean; isIncluded?: boolean; options?: Array<{ label: string; delta?: number }> };
    type DateGroup = { date: string; startTime: string; endTime?: string; items: DateItem[] };
    const skipPkgIds = new Set(packageInfo?.bookableServices.map(b => b.serviceId) || []);
    const trialId = packageInfo?.trialAddon?.serviceId;
    const trialDbm = packageInfo?.trialAddon?.daysBeforeMain || 0;

    const groupsByDate = new Map<string, DateGroup>();
    const ensureGroup = (date: string, startTime: string, endTime?: string) => {
      if (!groupsByDate.has(date)) {
        groupsByDate.set(date, { date, startTime, endTime, items: [] });
      }
      return groupsByDate.get(date)!;
    };

    for (const a of assignments) {
      const isTrial = a.service.id === trialId;
      const isPkgService = skipPkgIds.has(a.service.id);
      const sDbm = isTrial ? trialDbm : ((a.service as Record<string, unknown>).daysBeforeMain as number | null | undefined) || 0;

      // ¿Va al grupo central o a un grupo anticipado?
      const goesToAdvance = sDbm > 0 && !!advanceDates[sDbm]?.date;
      const date = goesToAdvance ? advanceDates[sDbm].date : selectedDate;
      const startTime = goesToAdvance ? (advanceDates[sDbm].startTime || '—') : (selectedSlot?.start || '');
      const groupEndTime = goesToAdvance ? undefined : endTime;

      const group = ensureGroup(date, startTime, groupEndTime);
      const isAddon = isTrial && trialEnabled && !!packageInfo?.trialAddon;
      const eff = effectivePricing(a.service, modifierSelections[a.service.id]);
      const price = isAddon
        ? (packageInfo!.trialAddon!.extraPricePen)
        : (isPkgService ? 0 : eff.pricePen);

      // Modificadores seleccionados (para mostrar en el ticket)
      const sel = modifierSelections[a.service.id];
      const mGroups = (a.service as Service & { modifierGroups?: ModifierGroup[] }).modifierGroups || [];
      const options: Array<{ label: string; delta?: number }> = [];
      if (sel && mGroups.length > 0) {
        for (const g of mGroups) {
          const gSel = sel[g.id];
          if (!gSel) continue;
          for (const optId of (gSel.optionIds || [])) {
            const opt = g.options.find(o => o.id === optId);
            if (opt) {
              const delta =
                opt.modifierType === 'fixed' ? Number(opt.modifierValue) :
                opt.modifierType === 'percent' ? Number(a.service.pricePen) * Number(opt.modifierValue) / 100 :
                opt.modifierType === 'multiplier' ? Number(a.service.pricePen) * (Number(opt.modifierValue) - 1) :
                Number(opt.modifierValue);
              options.push({ label: `${g.name}: ${opt.label}`, delta });
            }
          }
        }
      }
      group.items.push({
        name: a.service.name,
        staff: a.onDuty ? '✦ Estilista de turno' : (a.staff?.name || '—'),
        price,
        isAddon,
        // Servicio del paquete (no addon): se muestra "Incluido en el paquete".
        isIncluded: isPkgService && !isAddon,
        ...(options.length > 0 ? { options } : {}),
      });
    }

    // Ordenar grupos: día central primero, luego por fecha asc
    const dateGroups: DateGroup[] = Array.from(groupsByDate.values()).sort((a, b) => {
      if (a.date === selectedDate) return -1;
      if (b.date === selectedDate) return 1;
      return a.date.localeCompare(b.date);
    });

    // Texto breve que acompaña a la imagen en WhatsApp
    const wsText =
      `✨ Reserva en Deyanira Makeup Beauty\n` +
      `Nombre: ${guestInfo.name}\n` +
      `Total: S/ ${totalAmt.toFixed(2)}\n` +
      (atHome ? `🏠 A domicilio: ${atHomeAddress}, ${atHomeDistrict}\n` : '') +
      `⏳ A la espera de confirmación del salón.`;

    // Datos para el ticket (componente <BookingTicket>)
    const ticketGroups: TicketDateGroup[] = dateGroups.map((g) => ({
      date: g.date,
      startTime: g.startTime,
      endTime: g.endTime,
      items: g.items as TicketItem[],
    }));

    // Props del ticket que se envía como imagen (con logo, colores de marca).
    // Usamos el logo pre-cargado como data:URL para evitar errores CORS.
    const ticketProps = {
      customerName: guestInfo.name,
      customerPhone: guestInfo.phone,
      customerEmail: guestInfo.email || authUser?.email,
      packageName: packageInfo?.name,
      packageLabel: packageInfo?.groupLabel || undefined,
      packagePricePen: packageInfo?.pricePen,
      dateGroups: ticketGroups,
      totalPen: totalAmt,
      atHome: atHome ? { address: atHomeAddress, district: atHomeDistrict } : null,
      bookingId: (confirmed as { id?: string })?.id,
      salonName: salonInfo.name,
      salonPhone: salonInfo.phone,
      salonWhatsapp: salonInfo.whatsapp,
      salonInstagram: salonInfo.instagram,
      logoUrl: logoDataUrl || undefined, // solo si pre-carga fue exitosa
    };

    return (
      <div className="p-4 md:p-6">
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: 'linear-gradient(135deg, rgba(37,211,102,0.2), rgba(37,211,102,0.1))', border: '1px solid rgba(37,211,102,0.3)' }}>
            <CalendarCheck className="w-10 h-10" strokeWidth={2.5} style={{ color: '#25D366' }} />
          </div>
          <h2 className="font-display font-bold italic text-3xl text-white mb-2">¡Solicitud recibida!</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Te enviamos un correo con los detalles. <strong className="text-white">El salón confirmará tu cita</strong> muy pronto.
          </p>
        </div>

        {/* Resumen simple en pantalla — sin logo, solo los datos clave.
            El diseño "premium" con logo se reserva para la imagen de WhatsApp. */}
        <div className="mb-5">
          <BookingSummary
            customerName={guestInfo.name}
            packageName={packageInfo?.name}
            packageLabel={packageInfo?.groupLabel || undefined}
            packagePricePen={packageInfo?.pricePen}
            dateGroups={ticketGroups}
            totalPen={totalAmt}
            atHome={atHome ? { address: atHomeAddress, district: atHomeDistrict } : null}
          />
        </div>

        {hasOnDuty && (
          <div className="rounded-xl p-4 mb-5 text-xs mx-auto" style={{
            background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)',
            color: 'rgba(212,175,55,0.9)', maxWidth: 600,
          }}>
            <p className="font-bold mb-1">✦ Sobre tu estilista de turno</p>
            <p style={{ color: 'rgba(255,255,255,0.6)' }}>
              El salón asignará a la especialista disponible y te confirmará por WhatsApp quién te atenderá.
            </p>
          </div>
        )}

        {/* Ticket renderizado fuera de pantalla — fuente fija 600px para html-to-image */}
        <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }} aria-hidden="true">
          <BookingTicket ref={ticketRef} {...ticketProps} />
        </div>

        <div className="flex flex-col gap-3 max-w-xl mx-auto">
          {whatsappError && (
            <div
              className="rounded-xl px-4 py-3 text-xs flex items-start gap-2"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}
            >
              <span>⚠️</span>
              <span>{whatsappError}</span>
            </div>
          )}
          <button
            onClick={async () => {
              if (whatsappLoading) return;
              setWhatsappLoading(true);
              setWhatsappError('');
              const appointmentId = (confirmed as { id?: string })?.id;
              const salonWa = salonInfo.whatsapp || salonInfo.phone || '';
              const salonWaDigits = salonWa.replace(/\D/g, '');
              try {
                // 1. Generamos la imagen del ticket
                const blob = await generateTicketBlob(ticketRef.current);
                if (!blob) {
                  setWhatsappError('No se pudo generar la imagen. Se enviará solo el texto.');
                  const base = salonWaDigits ? `https://wa.me/${salonWaDigits}` : 'https://wa.me/';
                  window.open(`${base}?text=${encodeURIComponent(wsText)}`, '_blank', 'noopener,noreferrer');
                  return;
                }

                // 2. Mobile: compartir como archivo adjunto real
                const shared = await tryNativeShareWithFile(blob, wsText);
                if (shared) {
                  return;
                }

                // 3. Desktop: subir a Cloudinary → WhatsApp previsualiza la URL
                if (!appointmentId || !authUser?.token) {
                  setWhatsappError('Falta información de la reserva para subir la imagen.');
                  const base = salonWaDigits ? `https://wa.me/${salonWaDigits}` : 'https://wa.me/';
                  window.open(`${base}?text=${encodeURIComponent(wsText)}`, '_blank', 'noopener,noreferrer');
                  return;
                }
                let imageUrl = '';
                try {
                  const dataUrl = await blobToDataUrl(blob);
                  const { url } = await api.bookings.shareImage(
                    { appointmentId, image: dataUrl },
                    authUser.token,
                  );
                  imageUrl = url;
                } catch (err) {
                  const msg = err instanceof Error ? err.message : 'Error desconocido';
                  console.error('[WhatsApp] Upload falló:', err);
                  setWhatsappError(`No se pudo subir la imagen: ${msg}. Reinicia el backend si acabas de actualizar.`);
                  return;
                }

                // 4. Abrimos WhatsApp con texto + URL (WhatsApp previsualiza la imagen)
                const finalText = `${wsText}\n\n🖼️ Detalle visual:\n${imageUrl}`;
                const base = salonWaDigits ? `https://wa.me/${salonWaDigits}` : 'https://wa.me/';
                window.open(`${base}?text=${encodeURIComponent(finalText)}`, '_blank', 'noopener,noreferrer');
              } catch (err) {
                console.error('[WhatsApp] Error inesperado:', err);
                setWhatsappError('Ocurrió un error inesperado. Intenta de nuevo.');
              } finally {
                setWhatsappLoading(false);
              }
            }}
            disabled={whatsappLoading}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full font-semibold text-xs transition-all active:scale-95 disabled:opacity-60"
            style={{ background: 'transparent', color: '#25D366', border: '1px solid rgba(37,211,102,0.5)' }}>
            <Phone className="w-3.5 h-3.5" />
            {whatsappLoading ? 'Preparando imagen...' : 'Compartir comprobante por WhatsApp (opcional)'}
          </button>
          <a href="/mi-cuenta/citas"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-full font-bold text-sm text-white transition-all active:scale-95 order-first"
            style={{ background: 'linear-gradient(135deg, #FF4FA2, #e6368a)', boxShadow: '0 4px 20px rgba(255,79,162,0.4)' }}>
            <CalendarCheck className="w-4 h-4" /> Ver mis citas
          </a>
          <button onClick={handleReset}
            className="w-full py-3 text-sm font-medium"
            style={{ color: 'rgba(255,255,255,0.4)' }}>
            Hacer otra reserva
          </button>
        </div>

      </div>
    );
  }

  return (
    <div ref={wizardTopRef} className="flex flex-col scroll-mt-20">
      <StepBar step={step} onGoTo={goToStep} />
      {/* En el paso 1 el resumen del paquete vive dentro del PackageCard;
          en pasos posteriores mostramos el banner compacto como recordatorio. */}
      {packageInfo && step > 1 && (
        <PackageBanner pkg={packageInfo} onClear={clearPackage} />
      )}
      <div className="px-5 pt-4 pb-2">
        {step === 1 && (
          <ServiceStep
            selected={selectedServices}
            onToggle={toggleService}
            onNext={() => setStep(2)}
            initialServiceId={initialServiceId}
            initialServiceIds={initialServiceIds}
            initialCategorySlug={initialCategorySlug}
            packageInfo={packageInfo}
            trialEnabled={trialEnabled}
            setTrialEnabled={setTrialEnabled}
            onClearPackage={clearPackage}
            modifierSelections={modifierSelections}
            onModifierSelectionsChange={(serviceId, sel) =>
              setModifierSelections((prev) => ({ ...prev, [serviceId]: sel }))
            }
          />
        )}
        {step === 2 && selectedServices.length > 0 && (
          <StaffAssignmentStep
            selectedServices={selectedServices}
            assignments={assignments}
            onAssign={handleAssign}
            packageInfo={packageInfo}
            modifierSelections={modifierSelections}
            onNext={() => {
              // Only reset date/slot if the assignment combo changed (different stylist/service)
              const newKey = assignments.map(a => `${a.service.id}:${a.onDuty ? 'duty' : a.staff?.id}`).sort().join('|');
              if (newKey !== lastSlotKey) {
                setSelectedDate('');
                setSelectedSlot(null);
                setLastSlotKey(newKey);
              }
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && assignments.length > 0 && (
          <SlotStep
            assignments={assignments}
            date={selectedDate}
            slot={selectedSlot}
            onDateChange={setSelectedDate}
            onSlotSelect={setSelectedSlot}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
            timerExpiredError={error}
            onClearError={() => setError('')}
            packageInfo={packageInfo}
            trialEnabled={trialEnabled}
            advanceDates={advanceDates}
            setAdvanceDates={setAdvanceDates}
            modifierSelections={modifierSelections}
          />
        )}
        {step === 4 && (
          <>
          {/* Honeypot anti-bot: oculto a humanos, los bots lo rellenan */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
          />
          <Turnstile onToken={setTurnstileToken} theme="dark" className="mb-3 flex justify-center" />
          <ConfirmStep
            assignments={assignments}
            packageInfo={packageInfo}
            trialEnabled={trialEnabled}
            date={selectedDate}
            slot={selectedSlot}
            guestInfo={guestInfo}
            setGuestInfo={setGuestInfo}
            atHome={atHome}
            setAtHome={setAtHome}
            atHomeAddress={atHomeAddress}
            setAtHomeAddress={setAtHomeAddress}
            atHomeDistrict={atHomeDistrict}
            setAtHomeDistrict={setAtHomeDistrict}
            atHomeEnabled={atHomeEnabled}
            loading={loading}
            error={error}
            timerLeft={timerLeft}
            onBack={() => setStep(3)}
            onConfirm={handleConfirm}
            modifierSelections={modifierSelections}
          />
          </>
        )}
      </div>
    </div>
  );
}

// ── Category filter chips ──────────────────────────────────
