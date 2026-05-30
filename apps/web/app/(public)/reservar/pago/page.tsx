'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import CulqiCheckout from '@/components/payments/CulqiCheckout';
import {
  CreditCard, Upload, CheckCircle2, Clock, ShieldCheck, Copy, Loader2, CalendarCheck,
} from 'lucide-react';

const money = (n: number) => `S/ ${Number(n || 0).toFixed(2)}`;

type Payment = Awaited<ReturnType<typeof api.bookingPayments.get>>;

function PagoInner() {
  const params = useSearchParams();
  const router = useRouter();
  const bp = params.get('bp') || '';

  const [data, setData] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'card' | 'transfer'>('card');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofMethod, setProofMethod] = useState<'yape' | 'plin' | 'transfer'>('yape');
  const [done, setDone] = useState<null | 'paid' | 'awaiting'>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useMemo(() => async () => {
    if (!bp) { setError('Reserva no encontrada'); setLoading(false); return; }
    try {
      const d = await api.bookingPayments.get(bp);
      setData(d);
      setEmail(d.customerEmail || '');
      if (d.status === 'paid') setDone('paid');
      else if (d.status === 'awaiting_verification') setDone('awaiting');
      // Sin tarjeta configurada → forzar transferencia
      if (!d.culqiPublicKey) setTab('transfer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la reserva');
    } finally { setLoading(false); }
  }, [bp]);

  useEffect(() => { load(); }, [load]);

  async function payCard(token: string) {
    if (!data) return;
    setBusy(true); setError('');
    try {
      await api.bookingPayments.culqi(bp, { culqiToken: token, email: email || data.customerEmail || '' });
      router.push(`/reserva/${bp}/recibo`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo procesar el pago');
      setBusy(false);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setError('La imagen no debe superar 8MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setProofPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function submitProof() {
    if (!proofPreview) { setError('Adjunta una imagen del comprobante'); return; }
    setBusy(true); setError('');
    try {
      await api.bookingPayments.uploadProof(bp, { image: proofPreview, method: proofMethod });
      setDone('awaiting');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir el comprobante');
    } finally { setBusy(false); }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F0F0F' }}>
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#E8C040' }} />
    </div>;
  }

  if (error && !data) {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center" style={{ background: '#0F0F0F' }}>
      <p className="text-white text-lg font-semibold">{error}</p>
      <Link href="/reservar" className="btn-gold">Volver a reservar</Link>
    </div>;
  }

  const d = data!;
  const salon = (d.salon || {}) as Record<string, string>;

  // Pantallas de estado final
  if (done === 'paid' || d.status === 'paid') {
    return <StatusScreen
      icon={<CheckCircle2 className="w-9 h-9" style={{ color: '#16a34a' }} />}
      title="¡Adelanto confirmado!"
      desc="Tu reserva quedó confirmada. Te enviamos el recibo por correo."
      cta={<Link href={`/reserva/${bp}/recibo`} className="btn-gold">Ver mi recibo</Link>}
    />;
  }
  if (done === 'awaiting') {
    return <StatusScreen
      icon={<Clock className="w-9 h-9" style={{ color: '#E8C040' }} />}
      title="Comprobante recibido"
      desc="Estamos verificando tu pago. Apenas lo confirmemos, tu reserva quedará confirmada y te enviaremos el recibo."
      cta={<Link href="/mi-cuenta" className="btn-outline">Ir a mi cuenta</Link>}
    />;
  }

  return (
    <div className="min-h-screen pt-20 pb-16 px-4" style={{ background: '#0F0F0F' }}>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-2" style={{ color: 'rgba(232,192,64,0.8)' }}>Casi listo</p>
          <h1 className="font-display font-bold italic text-3xl md:text-4xl text-white">Confirma tu reserva con el adelanto</h1>
          <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Para asegurar tu fecha, paga el {d.depositPercent}% de adelanto. El saldo se paga el día del servicio.
          </p>
        </div>

        <div className="grid md:grid-cols-5 gap-5">
          {/* Resumen */}
          <div className="md:col-span-2 rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(232,192,64,0.15)' }}>
            {d.package && (
              <div className="mb-4">
                <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#b8962e' }}>Paquete</span>
                <p className="font-display font-bold text-lg text-white">{d.package.name}</p>
              </div>
            )}
            <div className="space-y-2 mb-4">
              {d.appointments.map((a) => (
                <div key={a.id} className="flex justify-between text-xs">
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>{a.serviceName}</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{a.startTime}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 space-y-1.5" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <Row label="Total" value={money(d.totalPen)} />
              <Row label={`Adelanto (${d.depositPercent}%)`} value={money(d.depositPen)} highlight />
              <Row label="Saldo el día del servicio" value={money(d.balancePen)} muted />
            </div>
            <div className="mt-4 flex items-center gap-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <ShieldCheck className="w-3.5 h-3.5" style={{ color: '#16a34a' }} /> Pago seguro · datos protegidos
            </div>
          </div>

          {/* Métodos de pago */}
          <div className="md:col-span-3 rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex gap-2 mb-5">
              {d.culqiPublicKey && (
                <TabBtn active={tab === 'card'} onClick={() => setTab('card')} icon={<CreditCard className="w-4 h-4" />}>Tarjeta</TabBtn>
              )}
              <TabBtn active={tab === 'transfer'} onClick={() => setTab('transfer')} icon={<Upload className="w-4 h-4" />}>Transferencia / Yape</TabBtn>
            </div>

            {error && <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(220,38,38,0.12)', color: '#fca5a5' }}>{error}</p>}

            {tab === 'card' && d.culqiPublicKey && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Email para el recibo</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@email.com" className="input-dark" />
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Se cobrará <strong style={{ color: '#fff' }}>{money(d.depositPen)}</strong> a tu tarjeta.
                </p>
                <CulqiCheckout
                  publicKey={d.culqiPublicKey}
                  amountCents={Math.round(d.depositPen * 100)}
                  title={d.package?.name || 'Reserva'}
                  email={email}
                  disabled={busy || !email}
                  onToken={payCard}
                  onError={(m) => setError(m)}
                  label={busy ? 'Procesando…' : `Pagar ${money(d.depositPen)}`}
                />
              </div>
            )}

            {tab === 'transfer' && (
              <div className="space-y-3">
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  Transfiere <strong style={{ color: '#E8C040' }}>{money(d.depositPen)}</strong> a uno de estos medios y adjunta tu comprobante:
                </p>
                <div className="space-y-2">
                  {salon.yapeNumber && <PayInfo label={`Yape${salon.yapeName ? ` · ${salon.yapeName}` : ''}`} value={salon.yapeNumber} />}
                  {salon.plinNumber && <PayInfo label="Plin" value={salon.plinNumber} />}
                  {salon.bankAccount && <PayInfo label={`${salon.bankName || 'Banco'}${salon.bankAccountHolder ? ` · ${salon.bankAccountHolder}` : ''}`} value={salon.bankAccount} />}
                  {salon.bankCci && <PayInfo label="CCI" value={salon.bankCci} />}
                  {!salon.yapeNumber && !salon.plinNumber && !salon.bankAccount && (
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Escríbenos por WhatsApp para coordinar el pago.</p>
                  )}
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Método usado</label>
                  <div className="flex gap-2 mb-3">
                    {(['yape', 'plin', 'transfer'] as const).map((m) => (
                      <button key={m} type="button" onClick={() => setProofMethod(m)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors"
                        style={proofMethod === m
                          ? { background: '#E8C040', color: '#1a1a1a' }
                          : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}>
                        {m === 'transfer' ? 'Transferencia' : m}
                      </button>
                    ))}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed rounded-xl py-6 flex flex-col items-center gap-2 transition-colors"
                    style={{ borderColor: 'rgba(232,192,64,0.3)', color: 'rgba(255,255,255,0.6)' }}>
                    {proofPreview
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={proofPreview} alt="Comprobante" className="max-h-40 rounded-lg" />
                      : <><Upload className="w-6 h-6" style={{ color: '#E8C040' }} /><span className="text-xs">Adjuntar comprobante de pago</span></>}
                  </button>
                  <button type="button" onClick={submitProof} disabled={busy || !proofPreview}
                    className="w-full btn-gold mt-3 disabled:opacity-50">
                    {busy ? 'Enviando…' : 'Enviar comprobante'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight, muted }: { label: string; value: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <span className={highlight ? 'font-display font-bold text-lg' : 'text-sm'} style={{ color: highlight ? '#E8C040' : muted ? 'rgba(255,255,255,0.45)' : '#fff' }}>{value}</span>
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors"
      style={active ? { background: 'rgba(232,192,64,0.15)', color: '#E8C040', border: '1px solid rgba(232,192,64,0.4)' } : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {icon}{children}
    </button>
  );
}

function PayInfo({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
        <p className="text-sm font-semibold text-white truncate">{value}</p>
      </div>
      <button type="button" onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="shrink-0 p-2 rounded-lg" style={{ background: 'rgba(232,192,64,0.12)', color: '#E8C040' }}>
        {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

function StatusScreen({ icon, title, desc, cta }: { icon: React.ReactNode; title: string; desc: string; cta: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0F0F0F' }}>
      <div className="max-w-md text-center">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {icon}
        </div>
        <h1 className="font-display font-bold italic text-3xl text-white mb-3 flex items-center justify-center gap-2">
          <CalendarCheck className="w-6 h-6" style={{ color: '#E8C040' }} />{title}
        </h1>
        <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>{desc}</p>
        {cta}
      </div>
    </div>
  );
}

export default function PagoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#0F0F0F' }} />}>
      <PagoInner />
    </Suspense>
  );
}
