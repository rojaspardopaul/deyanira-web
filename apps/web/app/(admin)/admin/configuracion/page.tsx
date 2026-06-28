'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { invalidateSalonSettingsCache } from '@/lib/useSalonSettings';
import Link from 'next/link';
import { ChevronLeft, Save, Check } from 'lucide-react';
import DateTimePicker from '@/components/ui/datetime';
import Select from '@/components/ui/Select';
import { LIMA_DISTRICTS } from '@/lib/districts';

type Settings = Record<string, string | number | boolean | null | unknown[]>;

export default function AdminConfiguracionPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { router.push('/admin/login'); return; }
    adminApi(token).settings.get()
      .then((data) => {
        setSettings(data as Settings);
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
  }, [router]);

  async function handleSave() {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      await adminApi(token).settings.update(settings);
      invalidateSalonSettingsCache();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const set    = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setSettings(s => ({ ...s, [k]: e.target.value }));
  const toggle = (k: string) => () =>
    setSettings(s => ({ ...s, [k]: !s[k] }));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin" className="text-gray-500 hover:text-primary-600"><ChevronLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold text-2xl text-gray-900">Configuración</h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`ml-auto flex items-center gap-2 px-4 py-2 font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 ${
              saved ? 'bg-green-500 text-white' : 'bg-primary-600 text-white hover:bg-primary-500'
            }`}
          >
            {saved ? <><Check className="w-4 h-4" /> Guardado</> : <><Save className="w-4 h-4" />{saving ? 'Guardando...' : 'Guardar'}</>}
          </button>
        </div>

        <div className="space-y-5">
          {/* Información básica */}
          <Section title="Información del salón">
            <Field label="Nombre del salón" value={settings.salonName as string || ''} onChange={set('salonName')} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Teléfono" value={settings.phone as string || ''} onChange={set('phone')} placeholder="+51 9XX XXX XXX" />
              <Field label="WhatsApp" value={settings.whatsapp as string || ''} onChange={set('whatsapp')} placeholder="+51 9XX XXX XXX" />
            </div>
            <Field label="Email" type="email" value={settings.email as string || ''} onChange={set('email')} />
          </Section>

          {/* Ubicación */}
          <Section title="Ubicación">
            <Field label="Dirección" value={settings.address as string || ''} onChange={set('address')} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Distrito" value={settings.district as string || ''} onChange={set('district')} />
              <Field label="Ciudad" value={settings.city as string || 'Lima'} onChange={set('city')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitud" type="number" value={String(settings.lat || '')} onChange={set('lat')} placeholder="-12.1109" />
              <Field label="Longitud" type="number" value={String(settings.lng || '')} onChange={set('lng')} placeholder="-76.8182" />
            </div>
          </Section>

          {/* Horarios */}
          <Section title="Horarios de atención">
            <Field label="Lunes a Viernes" value={settings.hoursWeekday as string || ''} onChange={set('hoursWeekday')} placeholder="9:00 - 19:00" />
            <Field label="Sábado" value={settings.hoursSaturday as string || ''} onChange={set('hoursSaturday')} placeholder="9:00 - 17:00" />
            <Field label="Domingo" value={settings.hoursSunday as string || ''} onChange={set('hoursSunday')} placeholder="Cerrado" />
          </Section>

          {/* Reservas */}
          <Section title="Configuración de reservas">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Anticipación mínima (horas)" type="number" value={String(settings.bookingNoticeHours || '2')} onChange={set('bookingNoticeHours')} />
              <Field label="Cancelación mínima (horas)" type="number" value={String(settings.cancellationHours || '24')} onChange={set('cancellationHours')} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Tiempo límite para confirmar reserva (minutos)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={Math.round(Number(settings.bookingTimerSeconds ?? 600) / 60)}
                onChange={(e) => setSettings(s => ({ ...s, bookingTimerSeconds: Number(e.target.value) * 60 }))}
                placeholder="10"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Tiempo que tiene el cliente para completar el último paso de la reserva antes de que expire el slot (actualmente: {Math.round(Number(settings.bookingTimerSeconds ?? 600) / 60)} min)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Hora mínima general (HH:MM)
                </label>
                <DateTimePicker
                  mode="time"
                  theme="light"
                  minuteStep={30}
                  value={String(settings.bookingMinHour || '09:00')}
                  onChange={(v) => setSettings(s => ({ ...s, bookingMinHour: v }))}
                />
                <p className="text-[10px] text-gray-400 mt-1">Para servicios sueltos</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Hora mínima paquetes (HH:MM)
                </label>
                <DateTimePicker
                  mode="time"
                  theme="light"
                  minuteStep={30}
                  value={settings.packageMinHour ? String(settings.packageMinHour) : null}
                  onChange={(v) => setSettings(s => ({ ...s, packageMinHour: v }))}
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-gray-400">Ej. 06:00 para novias / eventos. Vacío = usar general.</p>
                  {settings.packageMinHour && (
                    <button
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, packageMinHour: null }))}
                      className="text-[10px] text-primary-600 hover:underline shrink-0 ml-2"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Section>

          {/* Tienda online */}
          <Section title="Tienda online">
            <ToggleField
              label="Habilitar tienda online"
              description="Si la apagas, /tienda muestra “próximamente” y se ocultan los enlaces de Tienda en la web."
              checked={settings.storeEnabled !== false}
              onChange={toggle('storeEnabled')}
            />
          </Section>

          {/* Envío de productos (tienda) */}
          <Section title="Envío de productos (tienda)">
            <ToggleField
              label="Cobrar envío por distancia"
              description="Calcula el costo de envío de productos según el distrito (distancia desde Cieneguilla). Si lo apagas, el envío es gratis."
              checked={settings.shipEnabled !== false}
              onChange={toggle('shipEnabled')}
            />
            {settings.shipEnabled !== false && (
              <>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <Field label="Tarifa base (S/)" type="number" value={String(settings.shipBasePen ?? '10')} onChange={set('shipBasePen')} placeholder="10" />
                  <Field label="Km base incluidos" type="number" value={String(settings.shipBaseKm ?? '10')} onChange={set('shipBaseKm')} placeholder="10" />
                  <Field label="S/ por km adicional" type="number" value={String(settings.shipPerKmPen ?? '1.5')} onChange={set('shipPerKmPen')} placeholder="1.5" />
                </div>
                <div className="pt-3">
                  <Field label="Envío gratis desde (S/)" type="number" value={String(settings.shipFreeOverPen ?? '150')} onChange={set('shipFreeOverPen')} placeholder="150" />
                  <p className="text-xs text-gray-500 mt-1">Los pedidos iguales o mayores a este monto no pagan envío. El recojo en el salón siempre es gratis.</p>
                </div>
              </>
            )}
          </Section>

          {/* Servicio a domicilio */}
          <Section title="Servicio a domicilio">
            <ToggleField
              label="Habilitar servicio a domicilio"
              description="Permite que los clientes reserven citas en su domicilio"
              checked={!!settings.atHomeEnabled}
              onChange={toggle('atHomeEnabled')}
            />
            {settings.atHomeEnabled && (
              <div className="grid grid-cols-3 gap-3 pt-1">
                <Field label="Tarifa base (S/)" type="number" value={String(settings.atHomeBasePen || '120')} onChange={set('atHomeBasePen')} placeholder="120" />
                <Field label="Km base incluidos" type="number" value={String(settings.atHomeBaseKm || '15')} onChange={set('atHomeBaseKm')} placeholder="15" />
                <Field label="S/ por km adicional" type="number" value={String(settings.atHomeRatePen || '4')} onChange={set('atHomeRatePen')} placeholder="4" />
              </div>
            )}
            {settings.atHomeEnabled && (() => {
              const pickup = Array.isArray(settings.pickupDistricts) ? (settings.pickupDistricts as string[]) : [];
              const addPickup = (d: string) => {
                if (d && !pickup.includes(d)) setSettings(s => ({ ...s, pickupDistricts: [...pickup, d] }));
              };
              const removePickup = (d: string) =>
                setSettings(s => ({ ...s, pickupDistricts: pickup.filter(x => x !== d) }));
              return (
                <div className="pt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Distritos con opción &ldquo;el cliente recoge a la estilista&rdquo;
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    En estos distritos el cliente podrá elegir recoger y devolver a la estilista al salón,
                    <strong> sin recargo de movilidad</strong>. Por defecto: Cieneguilla.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {pickup.length === 0 && <span className="text-xs text-gray-400">Ninguno configurado</span>}
                    {pickup.map(d => (
                      <span key={d} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                        {d}
                        <button type="button" onClick={() => removePickup(d)} className="hover:text-amber-900 font-bold leading-none" aria-label={`Quitar ${d}`}>×</button>
                      </span>
                    ))}
                  </div>
                  <Select
                    theme="light"
                    value={null}
                    placeholder="Agregar distrito…"
                    searchable
                    options={(LIMA_DISTRICTS as string[]).filter((d) => !pickup.includes(d))}
                    onChange={addPickup}
                    ariaLabel="Agregar distrito de recojo"
                  />
                </div>
              );
            })()}
          </Section>

          {/* Datos de pago / Adelantos */}
          <Section title="Datos de pago (adelantos por transferencia)">
            <p className="text-xs text-gray-400 -mt-1 mb-2">
              Se muestran al cliente cuando elige pagar el adelanto por Yape, Plin o transferencia.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Número Yape" value={settings.yapeNumber as string || ''} onChange={set('yapeNumber')} placeholder="9XX XXX XXX" />
              <Field label="Titular Yape" value={settings.yapeName as string || ''} onChange={set('yapeName')} placeholder="Nombre del titular" />
              <Field label="Número Plin" value={settings.plinNumber as string || ''} onChange={set('plinNumber')} placeholder="9XX XXX XXX" />
              <Field label="Banco" value={settings.bankName as string || ''} onChange={set('bankName')} placeholder="BCP / BBVA…" />
              <Field label="N° de cuenta" value={settings.bankAccount as string || ''} onChange={set('bankAccount')} placeholder="191-XXXXXXX-0-XX" />
              <Field label="CCI" value={settings.bankCci as string || ''} onChange={set('bankCci')} placeholder="002-191-…" />
              <Field label="Titular de la cuenta" value={settings.bankAccountHolder as string || ''} onChange={set('bankAccountHolder')} placeholder="Razón social / nombre" />
              <Field label="Horas para vencer adelanto" type="number" value={String(settings.depositExpiryHours ?? 24)} onChange={set('depositExpiryHours')} placeholder="24" />
            </div>
          </Section>

          {/* Imágenes: ahora en su propio módulo */}
          <Section title="Imágenes (logos, portada y carrusel)">
            <p className="text-sm text-gray-600">
              Los logos, las fotos de la página Nosotros y el carrusel del inicio ahora se gestionan en{' '}
              <Link href="/admin/imagenes" className="font-semibold text-primary-600 hover:underline">Imágenes → Marca y portada</Link>.
            </p>
          </Section>

          {/* Redes sociales */}
          <Section title="Redes sociales">
            <Field label="Instagram" value={settings.instagramUrl as string || ''} onChange={set('instagramUrl')} placeholder="https://instagram.com/..." />
            <Field label="Facebook" value={settings.facebookUrl as string || ''} onChange={set('facebookUrl')} placeholder="https://facebook.com/..." />
            <Field label="TikTok" value={settings.tiktokUrl as string || ''} onChange={set('tiktokUrl')} placeholder="https://tiktok.com/@..." />
          </Section>

          <Section title="Legal (Términos, Devoluciones, Privacidad, INDECOPI)">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Razón social" value={settings.razonSocial as string || ''} onChange={set('razonSocial')} placeholder="Razón social del negocio" />
              <Field label="RUC" value={settings.ruc as string || ''} onChange={set('ruc')} placeholder="20XXXXXXXXXX" />
            </div>
            <p className="text-xs text-gray-400">
              Razón social y RUC se muestran en el Libro de Reclamaciones. Las páginas legales aceptan
              Markdown (## subtítulos, **negrita**, - listas). Si dejas un campo vacío, se usa una plantilla
              por defecto que puedes reemplazar.
            </p>
            {([
              ['Términos y Condiciones', 'termsMd'],
              ['Política de Cambios y Devoluciones', 'returnsPolicyMd'],
              ['Política de Privacidad', 'privacyMd'],
            ] as const).map(([label, key]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
                <textarea
                  value={(settings[key] as string) || ''}
                  onChange={(e) => setSettings(s => ({ ...s, [key]: e.target.value }))}
                  rows={6}
                  placeholder="(vacío = plantilla por defecto)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            ))}
          </Section>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className={`mt-6 w-full flex items-center justify-center gap-2 py-3.5 font-bold rounded-full text-sm transition-all disabled:opacity-50 ${
            saved ? 'bg-green-500 text-white' : 'bg-primary-600 text-white hover:bg-primary-500'
          }`}
          style={saved ? undefined : { boxShadow: '0 4px 20px rgba(219,39,119,0.35)' }}
        >
          {saved ? <><Check className="w-4 h-4" /> Configuración guardada</> : <><Save className="w-4 h-4" />{saving ? 'Guardando...' : 'Guardar configuración'}</>}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h2 className="font-semibold text-sm text-gray-700">{title}</h2>
      </div>
      <div className="p-5 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: React.ChangeEventHandler<HTMLInputElement>; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    </div>
  );
}

function ToggleField({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: () => void;
}) {
  return (
    <button type="button" onClick={onChange}
      className="w-full flex items-center justify-between gap-4 text-left">
      <div>
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <div className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-primary-500' : 'bg-gray-200'}`}>
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </button>
  );
}

